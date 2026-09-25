# ClipboardFilter - User Guide

## 📋 Overview

ClipboardFilter is an application that automatically filters your clipboard content in real-time. It detects and masks sensitive information such as credit card numbers, emails, social security numbers, and more.

## 🚀 Installation

### Windows
1. Download the installer from the releases page
2. Run `ClipboardFilter-Setup-1.0.0.exe`
3. Follow the installation wizard
4. The application starts automatically

### macOS
1. Download the DMG for your Mac (`-arm64` for Apple Silicon, `-x64` for Intel)
2. Open the DMG file
3. Drag ClipboardFilter to Applications
4. Launch from Applications folder
5. The first time you use the paste shortcut, allow ClipboardFilter in **System Settings › Privacy & Security › Accessibility** (needed to send Cmd+V)

**Note:** macOS will warn about an unsigned app. Go to System Settings > Privacy & Security to allow it.

### Linux
**AppImage (Universal):**
```bash
chmod +x ClipboardFilter-1.0.0.AppImage
./ClipboardFilter-1.0.0.AppImage
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i clipboard-filter_1.0.0_amd64.deb
```

**Fedora/RHEL:**
```bash
sudo rpm -i clipboard-filter-1.1.0.x86_64.rpm
```

**Arch Linux:**
```bash
sudo pacman -U clipboard-filter-1.1.0.pacman
```

#### Optional helpers (recommended)

| Session | Install | Why |
|---------|---------|-----|
| X11 (any desktop) | `xdotool` | automatic paste after filtering |
| Wayland (GNOME, KDE, Sway, Hyprland…) | `wl-clipboard` | reliable clipboard access in the background |
| Wayland | `ydotool` (+ `ydotoold` service) **or** `dotool` **or** `wtype` (wlroots only) | automatic paste after filtering |

Without a paste helper, the shortcut still works: the filtered text is put in the clipboard and you just press **Ctrl+V**.
Settings › *System compatibility* shows what was detected on your machine.

#### Wayland (GNOME / KDE Plasma)

- The global shortcut goes through the desktop portal (KDE Plasma 5.27+, GNOME 48+). GNOME asks you to confirm it the first time.
- If your desktop does not support it (older GNOME, AppImage without installed `.desktop` file…), create a **custom keyboard shortcut** in your desktop settings that runs:
  ```bash
  clipboardfilter --paste            # filter the clipboard, then paste
  clipboardfilter --filter-clipboard # only filter the clipboard
  ```
  (for an AppImage use its full path). The running instance handles the command instantly.
- **Automatic mode** (filter everything that is copied) needs `wl-clipboard` and a compositor supporting the data-control protocol (KDE Plasma, Sway, Hyprland…). It is limited on GNOME.
- **No tray icon on GNOME?** Install the *AppIndicator and KStatusNotifierItem Support* extension. Without it, the window is shown at startup and launching ClipboardFilter again reopens it.

#### Command line

| Option | Effect |
|--------|--------|
| `--paste` | Filter the clipboard and paste into the active window |
| `--filter-clipboard` | Filter the clipboard in place |
| `--toggle-auto` | Toggle automatic mode |
| `--show` | Open the configuration window |
| `--hidden` | Start in the background (used by auto-start) |

## ⚡ Quick Start

### First Launch
On first launch, ClipboardFilter will:
- Automatically detect your system language
- Apply your system theme (light/dark)
- Load 112 default filters across 7 categories

### Basic Usage
1. Copy text containing sensitive information
2. Press **Ctrl+Shift+V** (Cmd+Shift+V on macOS) to paste
3. The text is automatically filtered!

Or enable **automatic mode** (Settings › Behavior, or the tray menu): everything you copy is filtered right away and a normal Ctrl+V pastes the safe version.

**Example:**
```
Before: My credit card 4532-1234-5678-9010
After:  My credit card ****-****-****-****
```

## 📑 Tabs

### 🔍 Filters
Manage your replacement filters.

#### Default Categories:
- **💻 Developer** (33 filters): API keys, tokens, secrets
- **💰 Finance** (20 filters): Credit cards, IBAN, crypto
- **👤 Personal** (12 filters): Emails, phones, addresses
- **🏥 Health** (3 filters): Social security numbers
- **👔 HR** (5 filters): Employee numbers, badges
- **⚙️ System** (31 filters): IPs, system paths, UUIDs
- **💬 Communication** (8 filters): Slack, Discord, Teams URLs

#### Actions:
- **☑ Category checkbox**: Enable/disable all filters in category
- **▼ Arrow**: Expand/collapse category
- **+ Add filter**: Create a new custom filter
- **📁 New folder**: Organize your filters

### 🧪 Test
Test your filters before using them.

1. Paste text in the "Input" area
2. Click "Apply Filters"
3. See the result in the "Output" area

### 📦 Templates
Import/export filter packs.

#### Export:
1. Create your custom filters
2. Click "Export JSON"
3. Name your template
4. Save the .json file

#### Import:
1. Click "Import JSON"
2. Select a template file
3. Confirm the import

**Note:** Default filters are never exported.

### ⚙️ Settings

#### General
- **Language**: English, Français, Deutsch, Español, Italiano
- **Theme**: Auto, Light, Dark
- **Notifications**: Show system notifications
- **Auto-start**: Launch at system startup (Windows, macOS and Linux)
- **Start minimized**: Start in the system tray without opening the window

#### Behavior
- **When the shortcut is pressed**: filter and paste, or only filter the clipboard
- **Automatic mode**: filter everything that is copied
- **Clear the clipboard after**: wipe the clipboard after 10 s … 5 min (only if you did not copy something else meanwhile)

#### Shortcuts
- **Paste**: Ctrl+Shift+V (default)
- Click "🎙 Change" to change; a badge shows whether the shortcut is active

#### System compatibility
Shows the detected session (Windows, macOS, X11, Wayland), the available paste helper, the clipboard backend and tips for your desktop.

#### Data Management
- **↻ Reset all default filters**: Re-enable all default filters and restore deleted ones
- **🗑 Delete all custom categories/filters**: Erase your custom creations

## 🎯 Use Cases

### For Developers
- Hide API keys before sharing code
- Filter authentication tokens in logs
- Mask AWS/GCP/Azure secrets

### For Finance
- Protect credit card numbers
- Mask IBAN in emails
- Hide cryptocurrency addresses

### For HR
- Filter social security numbers
- Mask employee IDs
- Protect personal data

### For Technical Support
- Hide IP addresses in logs
- Mask sensitive system paths
- Filter session UUIDs

## 🔧 Creating a Custom Filter

1. Click "+ Add filter"
2. Fill in:
   - **Description**: Filter name
   - **Category**: Classification
   - **Pattern**: Text or regex to detect
   - **Replacement**: Substitution text
   - **☑ Use Regex**: If pattern is a regular expression
   - **☑ Enabled**: Active from creation
3. Click "Save"

**Simple Filter Example:**
- Description: My name
- Pattern: John Doe
- Replacement: [NAME REDACTED]

**Regex Filter Example:**
- Description: Badge number
- Pattern: `BADGE-\d{6}`
- Replacement: BADGE-******
- ☑ Use Regex

## 📁 Organizing with Folders

1. Click "📁 New folder"
2. Name the folder (e.g., "Project X")
3. Choose an emoji (e.g., 🚀)
4. On a filter, click 📋 to copy it to the folder

**Benefits:**
- Organize by project/client
- Enable/disable an entire folder at once
- Share filter collections

## 🌍 Multi-language Support

ClipboardFilter automatically detects your system language and switches between:
- 🇬🇧 English
- 🇫🇷 Français
- 🇩🇪 Deutsch
- 🇪🇸 Español
- 🇮🇹 Italiano

Change language in Settings > Language.

## 🎨 Customization

### Themes
- **Auto**: Follows the system theme
- **Light**: Light interface
- **Dark**: Dark interface (recommended)

### Shortcuts
Default: **Ctrl+Shift+V**

To change:
1. Settings > Shortcuts
2. Click "🎙 Edit"
3. Press your key combination
4. Validate

## ❓ FAQ

### The app doesn't filter my text
- Check that filters are enabled (✓)
- Test in the Test tab
- Verify the shortcut (Settings > Shortcuts)

### How do I temporarily disable a filter?
- Uncheck the box next to the filter
- Or uncheck the entire category

### Can I share my filters?
- Yes! Templates tab > Export JSON
- Send the .json file to colleagues
- They can import it via Templates > Import JSON

### Do filters slow down my system?
- No: the 112 default filters process a typical clipboard in well under a millisecond
- Filtering runs in a background thread; a badly written custom regular expression is stopped after 3 seconds and **nothing is pasted** (fail-safe)

### The shortcut does nothing on Linux
- Open Settings › *System compatibility*
- On Wayland, bind `clipboardfilter --paste` to a custom shortcut in your desktop settings (see Installation › Linux)
- Install a paste helper (`xdotool` on X11, `ydotool`/`dotool`/`wtype` on Wayland) or just press Ctrl+V after the shortcut

### How do I uninstall?
**Windows:**
- Settings > Apps
- Search "ClipboardFilter"
- Click Uninstall

**macOS:**
- Drag ClipboardFilter from Applications to Trash

**Linux:**
```bash
# Debian/Ubuntu
sudo apt remove clipboard-filter

# Fedora/RHEL
sudo rpm -e clipboard-filter
```

## 🆘 Support

- **GitHub Issues**: https://github.com/50bvd/clipboardfilter/issues
- **Documentation**: https://github.com/50bvd/clipboardfilter

## 📝 System Requirements

- **Windows**: Windows 10/11 (64-bit)
- **macOS**: macOS 12+ (Apple Silicon and Intel)
- **Linux**: any modern distribution (Ubuntu 22.04+, Debian 12+, Fedora 38+, Arch…), X11 or Wayland (GNOME, KDE Plasma, Xfce, Cinnamon, MATE, Sway, Hyprland…)

## 📄 License

ClipboardFilter is open-source software under the MIT License.

---

**Version:** 1.1.0  
**Last updated:** September 2026
