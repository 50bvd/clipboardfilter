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
1. Download `ClipboardFilter-1.0.0-arm64.dmg`
2. Open the DMG file
3. Drag ClipboardFilter to Applications
4. Launch from Applications folder

**Note:** macOS will warn about an unsigned app. Go to System Preferences > Security & Privacy to allow it.

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
sudo rpm -i clipboard-filter-1.0.0.x86_64.rpm
```

## ⚡ Quick Start

### First Launch
On first launch, ClipboardFilter will:
- Automatically detect your system language
- Apply your system theme (light/dark)
- Load 112 default filters across 7 categories

### Basic Usage
1. Copy text containing sensitive information
2. Press **Ctrl+Shift+V** to paste
3. The text is automatically filtered!

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
- **Auto-start**: Launch at system startup

#### Shortcuts
- **Paste**: Ctrl+Shift+V (default)
- Click "🎙 Edit" to change

#### Data Management
- **↻ Reset all default filters**: Re-enable all disabled default filters
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
- **Auto**: Follows Windows system theme
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
- No, filtering is nearly instantaneous (<100ms)
- The app uses <100MB of RAM

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
- **macOS**: macOS 10.12+ (Apple Silicon)
- **Linux**: Ubuntu 20.04+, Fedora 34+, or any modern distro

## 📄 License

ClipboardFilter is open-source software under the MIT License.

---

**Version:** 1.0.0  
**Last updated:** December 2025
