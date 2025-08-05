#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// ───────────────────────────────────────────
//─── MODULE SCOPE & CONFIG ─────────────────
//────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// config & storage in user home
const CONFIG_DIR  = path.join(os.homedir(), '.passwdm');
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const STORE_PATH  = path.join(CONFIG_DIR, 'store.json');

let masterKey;         // for encryption

// AES-GCM and policy
const IV_LEN  = 12;
const LOWER   = 'abcdefghijklmnopqrstuvwxyz';
const UPPER   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS  = '0123456789';
const SPECIAL = '!@#$^&*~';

// ───────────────────────────────────────────
//─── CONFIG LOADER & INIT SETUP ────────────
//────────────────────────────────────────────

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

async function initSetup() {
  console.log(chalk.blue('\n🔧 Initializing passwdm configuration…\n'));
  const { password, confirm } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: 'Set application access password:',
      mask: '*',
      validate: v => v.trim() ? true : 'Password cannot be empty'
    },
    {
      type: 'password',
      name: 'confirm',
      message: 'Confirm password:',
      mask: '*',
      validate: (v, answers) => v === answers.password ? true : 'Passwords do not match'
    }
  ]);

  const encryptionKey = crypto.randomBytes(32).toString('base64');
  const config = { appPassword: password, encryptionKey };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });

  console.log(chalk.green('\n✅  Configuration saved to:'), CONFIG_PATH);
  console.log(chalk.yellow('\n💾  Please save this ENCRYPTION_KEY somewhere safe:'));
  console.log(encryptionKey, '\n');
}

// ───────────────────────────────────────────
//─── INITIAL AUTH & KEY ────────────────────
//────────────────────────────────────────────

async function initAuth() {
  const { appPassword } = loadConfig();
  const { pwd } = await inquirer.prompt({
    type: 'password',
    name: 'pwd',
    message: 'Enter application access password:'
  });
  if (pwd !== appPassword) {
    console.error(chalk.red('✖  Invalid application password. Exiting.'));
    process.exit(1);
  }
}

function initEncryptionKey() {
  const { encryptionKey } = loadConfig();
  const buf = Buffer.from(encryptionKey, 'base64');
  if (buf.length !== 32) {
    console.error(chalk.red('✖  Invalid key length in config. Please run `passwdm init` again.'));
    process.exit(1);
  }
  masterKey = buf;
}

// ───────────────────────────────────────────
//─── ENCRYPT/DECRYPT UTILITIES ─────────────
//────────────────────────────────────────────

function encryptText(plain) {
  const iv     = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const ct     = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return [iv, ct, tag].map(b => b.toString('hex')).join(':');
}

function decryptText(payload) {
  const [ivHex, ctHex, tagHex] = payload.split(':');
  const iv  = Buffer.from(ivHex, 'hex');
  const ct  = Buffer.from(ctHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const dec = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(ct), dec.final()]).toString('utf8');
}

// ───────────────────────────────────────────
//─── STORE I/O ─────────────────────────────
//────────────────────────────────────────────

function loadStore() {
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ entries: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// ───────────────────────────────────────────
//─── PASSWORD GENERATOR & DEPRECATE ────────
//────────────────────────────────────────────

function generatePassword(length = 12) {
  if (length < 8) length = 8;
  const all  = LOWER + UPPER + DIGITS + SPECIAL;
  const pick = s => s[Math.floor(Math.random() * s.length)];
  const pw   = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SPECIAL)];
  while (pw.length < length) pw.push(pick(all));
  for (let i = pw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return pw.join('');
}

function deprecateEntry(e) {
  e.deprecated   = true;
  e.deprecatedAt = new Date().toISOString();
}

// ───────────────────────────────────────────
//─── CLI FLOWS ─────────────────────────────
//────────────────────────────────────────────

async function generateFlow() {
  const store = loadStore();
  const { name } = await inquirer.prompt({
    type: 'input', name: 'name', message: 'App/site name:',
    validate: s => s.trim() ? true : 'cannot be empty'
  });
  const pwd = generatePassword(12);
  const enc = encryptText(pwd);
  store.entries.push({
    id: crypto.randomUUID(),
    name: name.trim(),
    secret: enc,
    createdAt: new Date().toISOString(),
    deprecated: false
  });
  saveStore(store);
  console.log(chalk.green(`\n✅  New password for "${name}":\n\n    ${chalk.bold(pwd)}\n`));
  await pause();
}

async function getFlow() {
  const store  = loadStore();
  const active = store.entries.filter(e => !e.deprecated);
  if (!active.length) { console.log(chalk.yellow('No active passwords.')); await pause(); return; }
  const { id } = await inquirer.prompt({
    type: 'list', name: 'id', message: 'Select entry:',
    choices: active.map(e => ({
      name: `${e.name} (added ${new Date(e.createdAt).toLocaleString()})`,
      value: e.id
    }))
  });
  const entry = store.entries.find(e => e.id === id);

  let pwd;
  try {
    pwd = decryptText(entry.secret);
  } catch {
    console.log(chalk.red('✖  Decryption failed.'));
    const { onError } = await inquirer.prompt({
      type: 'list', name: 'onError', message: 'Handle corrupted entry?',
      choices: [
        { name: 'Back', value: 'back' },
        { name: 'Delete & new', value: 'regen' }
      ]
    });
    if (onError === 'regen') {
      const s2 = loadStore();
      s2.entries = s2.entries.filter(e => e.id !== entry.id);
      const newPwd = generatePassword(12);
      const newEnc = encryptText(newPwd);
      s2.entries.push({
        id: crypto.randomUUID(),
        name: entry.name,
        secret: newEnc,
        createdAt: new Date().toISOString(),
        deprecated: false
      });
      saveStore(s2);
      console.log(chalk.green(`\n🔄  Replaced with new password: \n\n    ${chalk.bold(newPwd)}\n`));
      await pause();
    }
    return;
  }

  console.log(chalk.cyan(`\n🔑  Password for "${entry.name}":\n\n    ${chalk.bold(pwd)}\n`));
  const { next } = await inquirer.prompt({
    type: 'list', name: 'next', message: 'Next?',
    choices: [
      { name: 'Deprecate+new', value: 'regen' },
      { name: 'Show deprecated', value: 'showOld' },
      { name: 'Back', value: 'back' },
      { name: 'Exit', value: 'exit' }
    ]
  });

  if (next === 'regen') {
    deprecateEntry(entry);
    const newPwd = generatePassword(12);
    const newEnc = encryptText(newPwd);
    store.entries.push({
      id: crypto.randomUUID(),
      name: entry.name,
      secret: newEnc,
      createdAt: new Date().toISOString(),
      deprecated: false
    });
    saveStore(store);
    console.log(chalk.green(`\n🔄  New password: \n\n    ${chalk.bold(newPwd)}\n`));
    await pause();
    return;
  }
  if (next === 'showOld') { await showDeprecated(); return; }
  if (next === 'back')    { return; }
  process.exit(0);
}

async function showDeprecated() {
  const store = loadStore();
  const old   = store.entries.filter(e => e.deprecated);
  if (!old.length) { console.log(chalk.yellow('No deprecated.')); await pause(); return; }
  const { id } = await inquirer.prompt({
    type: 'list', name: 'id', message: 'Select deprecated:',
    choices: old.map(e => ({
      name: `${e.name} (created ${new Date(e.createdAt).toLocaleString()}, deprecated ${new Date(e.deprecatedAt).toLocaleString()})`,
      value: e.id
    }))
  });
  const entry = store.entries.find(e => e.id === id);
  const pwd   = decryptText(entry.secret);
  console.log(chalk.gray(`\n❗  Deprecated for "${entry.name}":\n\n    ${chalk.bold(pwd)}\n`));
  await pause();
}

async function deleteFlow() {
  const store = loadStore();
  const names = [...new Set(store.entries.map(e => e.name))];
  if (!names.length) { console.log(chalk.yellow('No to delete.')); await pause(); return; }
  const { name } = await inquirer.prompt({
    type: 'list', name: 'name', message: 'Select site to delete:', choices: names
  });
  const { confirm } = await inquirer.prompt({
    type: 'confirm', name: 'confirm', message: `Delete ALL for "${name}"?`, default: false
  });
  if (!confirm) return;
  const before = store.entries.length;
  store.entries = store.entries.filter(e => e.name !== name);
  saveStore(store);
  console.log(chalk.green(`Deleted ${before - store.entries.length} entries for "${name}".`));
  await pause();
}

async function pause() {
  await inquirer.prompt([{ type: 'confirm', name: 'ok', message: 'Press ENTER', default: true }]);
}

async function mainMenu() {
  console.clear();
  console.log(chalk.blue.bold('\n🔐  CLI Password Manager\n'));
  const { action } = await inquirer.prompt({
    type: 'list', name: 'action', message: 'Choose:',
    choices: [
      { name: 'Generate', value: 'gen' },
      { name: 'Get',      value: 'get' },
      { name: 'Delete site', value: 'delete' },
      { name: 'Exit',     value: 'exit' }
    ]
  });
  if (action === 'gen')    await generateFlow();
  if (action === 'get')    await getFlow();
  if (action === 'delete') await deleteFlow();
  if (action === 'exit')   process.exit(0);
  await mainMenu();
}

// ───────────────────────────────────────────
//─── STARTUP WRAPPER ───────────────────────
//────────────────────────────────────────────

(async () => {
  const args = process.argv.slice(2);

  // explicit init
  if (args[0] === 'init') {
    await initSetup();
    process.exit(0);
  }

  // auto-init if no config found
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log(chalk.yellow('⚙️  No configuration found. Running setup.'));
    await initSetup();
  }

  await initAuth();
  initEncryptionKey();
  await mainMenu();
})();
