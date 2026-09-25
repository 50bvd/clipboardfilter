# <img src="assets/icon.png" alt="icon" style="width: 1em; height: 1em; vertical-align: -0.15em;"> ClipboardFilter

[![Build Status](https://github.com/50bvd/clipboardfilter/workflows/Build%20Multi-Platform/badge.svg)](https://github.com/50bvd/clipboardfilter/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-green.svg)](https://github.com/50bvd/clipboardfilter/releases)

A secure clipboard filtering application that automatically detects and masks sensitive information in real-time.

![image](https://50bvd.com/assets/img/Capture%20d%e2%80%99%c3%a9cran%202025-12-27%20185145.png)

## ✨ Features

- 🔒 **112 pre-configured filters** across 7 categories
- 🌍 **Multi-language support** (EN, FR, DE, ES, IT)
- ⚡ **Real-time filtering** with global hotkey (Ctrl+Shift+V)
- 🤖 **Automatic mode**: filters everything you copy, so a normal Ctrl+V is always safe
- 🧹 **Auto-clear** of the clipboard after a configurable delay
- 🐧 **Works on Windows, macOS and Linux** — X11 and Wayland (GNOME, KDE Plasma, Sway, Hyprland…)
- 🛡️ **Fail-safe filtering**: runs in a background thread, slow regexes are stopped and nothing is pasted
- 🧪 **Live preview** with per-filter match counts, 🔎 filter search
- 📦 **Template system** for import/export
- 🎨 **Auto theme detection** (Light/Dark)
- 🗂️ **Custom folders** for organization
- ⚙️ **Regex support** for advanced patterns (optionally case-sensitive)

## 📥 Download

Get the latest release for your platform:

- **Windows**: [ClipboardFilter-Setup.exe](https://github.com/50bvd/clipboardfilter/releases/download/v1.0.0/ClipboardFilter.Setup.1.0.0.exe)

- **Linux/Unix**: 
  - [AppImage](https://github.com/50bvd/clipboardfilter/releases/download/v1.0.0/ClipboardFilter-1.0.0.AppImage) (Universal)
  - [.deb](https://github.com/50bvd/clipboardfilter/releases/download/v1.0.0/clipboard-filter_1.0.0_amd64.deb) (Debian/Ubuntu)
  - [.rpm](https://github.com/50bvd/clipboardfilter/releases/download/v1.0.0/clipboard-filter-1.0.0.x86_64.rpm) (Fedora/RHEL)

- **macOS**: [ClipboardFilter.dmg for new Apple chip (ARM64)](https://github.com/50bvd/clipboardfilter/releases/download/v1.0.0/ClipboardFilter-1.0.0-arm64.dmg)
  - *__Note :__* starting with 1.1.0, Intel (x64) builds are published as well.

## 🚀 Quick Start

### Windows
1. Download `ClipboardFilter-Setup.exe`
2. Run the installer
3. Launch from Start Menu
4. Copy sensitive text and press **Ctrl+Shift+V** to paste filtered content

### Linux
```bash
# AppImage
chmod +x ClipboardFilter-*.AppImage
./ClipboardFilter-*.AppImage

# Debian/Ubuntu
sudo dpkg -i clipboard-filter_*.deb

# Fedora/RHEL
sudo rpm -i clipboard-filter-*.rpm

# Arch Linux
sudo pacman -U clipboard-filter-*.pacman
```

**Recommended helpers:** `xdotool` (X11) or `wl-clipboard` + `ydotool`/`dotool`/`wtype` (Wayland) for automatic pasting.
Without them, the shortcut filters the clipboard and you press Ctrl+V yourself.
On Wayland, if the global shortcut is not supported by your desktop, bind `clipboardfilter --paste` to a custom keyboard shortcut.
See the [User Guide](USER-GUIDE.md#linux) for details; Settings › *System compatibility* shows what was detected.

### macOS
1. Download `ClipboardFilter.dmg`
2. Open and drag to Applications
3. Launch ClipboardFilter

## 📖 Usage

### Default Filters

ClipboardFilter includes **112 filters** across these categories:

| Category | Count | Examples |
|----------|-------|----------|
| 💻 Developer | 33 | API keys, tokens, secrets |
| 💰 Finance | 20 | Credit cards, IBAN, crypto |
| 👤 Personal | 12 | Emails, phones, addresses |
| 🏥 Health | 3 | Social security numbers |
| 👔 HR | 5 | Employee IDs, badges |
| ⚙️ System | 31 | IPs, paths, UUIDs |
| 💬 Communication | 8 | Slack, Discord, Teams |

### Creating Custom Filters

1. Click **"+ Add Filter"**
2. Fill in:
   - **Description**: Filter name
   - **Category**: Classification
   - **Pattern**: Text or regex to detect
   - **Replacement**: Substitution text
   - ☑️ **Use Regex**: For pattern matching
3. Click **"Save"**

**Example:**
```
Description: Employee Badge
Pattern: BADGE-\d{6}
Replacement: BADGE-******
☑ Use Regex
```

### Templates

Export/import filter collections:

```bash
# Export your custom filters
Templates > Export JSON > "My Filters"

# Import a template
Templates > Import JSON > Select file
```

## 🛠️ Development

### Prerequisites
- Node.js 20+ (22 recommended)
- npm 9+

### Setup
```bash
git clone https://github.com/50bvd/clipboardfilter.git
cd clipboardfilter
npm install
```

### Build
```bash
npm run build      # Compile TypeScript
npm start          # Run in development
npm test           # Unit tests (filter engine, storage, ReDoS protection)
npm run bench      # Compare the filtering speed with 1.0.0
```

### Package
```bash
npm run package:win          # Windows
npm run package:linux        # Linux (AppImage, deb, rpm, pacman)
npm run package:mac          # macOS (x64 + arm64)
```

## 📚 Documentation

- [User Guide](USER-GUIDE.md) - Complete user manual
- [Developer Guide](DEVELOPER-GUIDE.md) - Technical documentation

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Loup LIGNON KRASNIQI**
- GitHub: [@50bvd](https://github.com/50bvd)
- Email: loup.lk-pro@protonmail.ch

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Icons from [Lucide](https://lucide.dev/)

---

**⭐ Star this repo if you find it useful!**









