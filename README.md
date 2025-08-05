# raspberry-password-manager

A simple AES-256-GCM–encrypted CLI password manager for the terminal.

---

## Table of Contents

- [Introduction](#introduction)  
- [Features](#features)  
- [Installation](#installation)  
  - [From npm](#from-npm)  
  - [From GitHub (development)](#from-github-development)  
- [Initialization](#initialization)  
- [Usage](#usage)  
- [Configuration & Data Files](#configuration--data-files)  
- [Updating](#updating)  
- [Uninstallation](#uninstallation)  
- [Contributing](#contributing)  
- [License](#license)  

---

## Introduction

**[`raspberry-password-manager`](https://www.npmjs.com/package/raspberry-password-manager)** (invoked as `passwdm`) is a zero-dependency Node.js CLI tool to:

- Generate strong, random passwords.  
- Encrypt them with AES-256-GCM.  
- Store them securely in your home directory (`~/.passwdm`).  
- Protect access via a master application password.  

Source code on GitHub: [jithinrajtnr/my-password-manager](https://github.com/jithinrajtnr/my-password-manager)

---

## Features

- One-time setup (`passwdm init`) for master password & encryption key.  
- Interactive menu:  
  - **Generate** a new password entry.  
  - **Get** (decrypt) an existing password.  
  - **Delete** all entries for a site.  
- Automatic home-directory storage (`~/.passwdm/store.json`).  
- Built with standard Node.js libraries, plus [`inquirer`](https://npmjs.com/package/inquirer) and [`chalk`](https://npmjs.com/package/chalk).

---

## Installation

### From npm

Install the CLI globally so `passwdm` is available on your `PATH`:

```bash
npm install -g raspberry-password-manager
```

Or view the package on npm: [https://www.npmjs.com/package/raspberry-password-manager](https://www.npmjs.com/package/raspberry-password-manager)

*Alternatively*, to include it as a dependency in another project:

```bash
npm install --save raspberry-password-manager
```

---

### From GitHub (development)

Clone the source and link the CLI for development:

```bash
# via SSH
git clone git@github.com:jithinrajtnr/my-password-manager.git

# or via HTTPS
git clone https://github.com/jithinrajtnr/my-password-manager.git

cd my-password-manager
npm install
npm link
passwdm init
```

---

## Initialization

Before first use, run:

```bash
passwdm init
```

This will:

1. Prompt you to **set** and **confirm** a master application password.  
2. Generate a **32-byte Base64** encryption key.  
3. Save both to `~/.passwdm/config.json` (file permissions `600`).  

> **Important**: Backup your encryption key! If you lose it, stored passwords become irretrievable.

---

## Usage

Launch the interactive menu:

```bash
passwdm
```

You’ll be asked for your master password, then presented with options:

- **Generate** – Create and display a new password.  
- **Get**      – Decrypt and show an existing password.  
- **Delete site** – Remove all entries for a chosen site.  
- **Exit**     – Quit the tool.

#### Example Session

```bash
$ passwdm
Enter application access password: ••••••••

🔐  CLI Password Manager

? Choose: (Use arrow keys)
❯ Generate
  Get
  Delete site
  Exit

# Choose “Generate”
? App/site name: example.com

✅  New password for "example.com":

    L8&dR#2qPpXe

Press ENTER
```

---

## Configuration & Data Files

All data lives under your home directory in `~/.passwdm`:

- **`config.json`**  
  ```json
  {
    "appPassword": "your-master-password",
    "encryptionKey": "wN7...base64-32-bytes...XJ4"
  }
  ```
- **`store.json`**  
  ```json
  {
    "entries": [
      {
        "id": "uuid",
        "name": "example.com",
        "secret": "<AES-GCM payload>",
        "createdAt": "2025-08-05T12:34:56.789Z",
        "deprecated": false
      }
    ]
  }
  ```

---

## Updating

After fixing bugs or adding features, bump the version in `package.json`:

```bash
npm version [patch|minor|major]
npm publish --access public
```

Users can then update:

```bash
npm update -g raspberry-password-manager
```

---

## Uninstallation

1. **Uninstall the CLI**  
   ```bash
   npm uninstall -g raspberry-password-manager
   ```
2. **Remove your data (optional)**  
   ```bash
   rm -rf ~/.passwdm
   ```

---

## Contributing

1. Fork this repository.  
2. Create a branch:  
   ```bash
   git checkout -b feature/awesome-new-feature
   ```
3. Make changes and commit.  
4. Push and open a pull request against `main`.

Please follow the existing code style and update documentation for any new behavior.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.  
