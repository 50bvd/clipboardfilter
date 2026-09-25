# ClipboardFilter - Developer Guide

## 🏗️ Architecture

### Technology Stack
- **Framework:** Electron 44
- **Language:** TypeScript (main process) + plain JavaScript (sandboxed renderer)
- **UI:** HTML5 + CSS3 (no framework)
- **Build:** npm + electron-builder 26
- **Runtime dependencies:** none

### Project Structure
```
clipboardfilter/
├── src/
│   ├── main.ts              # Main process: windows, tray, shortcut, IPC, notifications
│   ├── preload.ts           # Whitelisted API exposed to the renderer (contextBridge)
│   ├── filterEngine.ts      # Pure filtering engine (also the worker thread source)
│   ├── filterRunner.ts      # Runs the engine in a worker with a timeout (ReDoS-safe)
│   ├── filterManager.ts     # Filters / folders / settings, validation, migrations
│   ├── store.ts             # In-memory JSON store with atomic, debounced writes
│   ├── platform.ts          # Session detection, clipboard (wl-clipboard), autostart
│   ├── keyboardSimulator.ts # Paste keystroke: PowerShell helper / osascript / xdotool, ydotool, dotool, wtype
│   ├── clipboardWatcher.ts  # Automatic mode (polling or wl-paste --watch)
│   ├── localeManager.ts     # i18n with English fallback
│   ├── renderer.html        # UI markup (strict CSP, data-i18n attributes)
│   ├── renderer.js          # UI logic (no Node access, event delegation)
│   └── styles.css           # Styling
├── locales/                 # en, fr, de, es, it
├── test/                    # node:test unit tests
├── scripts/                 # build/run helpers, bench.js
├── default-filters.json     # Default filter library
└── package.json
```

### Security model
- The renderer runs with `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` and a strict CSP
  (`script-src 'self'`, no inline handlers). It only reaches the main process through the channels
  whitelisted in `preload.ts`; every IPC handler checks the sender and validates its input.
- Every dynamic value inserted in the DOM is escaped; imported templates are validated in the main process.
- Filtering runs in a worker thread. If it exceeds its time budget the worker is terminated and nothing is
  pasted (fail closed). The offending filter is reported in a notification.
- External tools are run with `execFile` (no shell) and a timeout. The configuration file is written with mode `0600`.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm 9+
- Windows 10/11 (for native builds)

### Setup
```bash
# Clone repository
git clone https://github.com/your-repo/clipboard-filter.git
cd clipboard-filter

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development
npm start
# or
.\scripts\run.ps1
```

## 🔧 Development

### File Watching
```bash
# Terminal 1: Watch TypeScript
npx tsc --watch

# Terminal 2: Run Electron
npm start
```

### Hot Reload
Renderer changes (HTML/CSS/JS) reload automatically.  
Main process changes require restart.

### DevTools
Press **F12** in the app to open Chrome DevTools.

## 📝 Code Guidelines

### TypeScript (main.ts)
```typescript
// Use strict typing
interface Settings {
  language: string;
  theme: 'auto' | 'light' | 'dark';
  notifications: boolean;
}

// Document public functions
/**
 * Loads user settings from file
 * @returns Settings object
 */
async function loadSettings(): Promise<Settings> {
  // ...
}
```

### JavaScript (renderer.js)
```javascript
// Use async/await for IPC
async function toggleFilter(id, enabled) {
  applyData(await call('filters:set-enabled', [id], enabled));
}

// Document complex functions
/**
 * Applies all enabled filters to text
 * @param {string} text - Input text
 * @returns {string} Filtered text
 */
function applyFilters(text) {
  // ...
}
```

### CSS (styles.css)
```css
/* Use CSS variables for theming */
:root {
  --primary: #3b82f6;
  --background: #1a1a1a;
  --surface: #2d2d2d;
  --text: #ffffff;
}

/* BEM naming convention */
.filter-card {}
.filter-card__title {}
.filter-card__title--active {}
```

## 🌍 Internationalization

### Adding a New Language

1. **Create locale file:**
```bash
cp locales/en.json locales/pt.json
```

2. **Translate all keys:**
```json
{
  "config": {
    "title": "ClipboardFilter - Configuração",
    "filtersTab": "Filtros",
    ...
  }
}
```

3. **Add to localeManager.ts:**
```typescript
const SUPPORTED_LOCALES = ['en', 'fr', 'de', 'es', 'it', 'pt'];
```

4. **Update language selector:**
```javascript
const localeNames = {
  'en': 'English',
  'fr': 'Français',
  'de': 'Deutsch',
  'es': 'Español',
  'it': 'Italiano',
  'pt': 'Português'
};
```

### Translation Keys
Always use `t()` function:
```javascript
document.getElementById('title').textContent = t('config.title');
showCustomAlert(t('errors.saveFailed'));
```

## 🎨 UI Components

### Modal Dialog
```javascript
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}
```

### Custom Alert
```javascript
async function showCustomAlert(message) {
  // Shows styled alert dialog
  // Returns Promise that resolves on OK
}
```

### Custom Confirm
```javascript
async function customConfirm(message) {
  // Shows confirm dialog with Cancel/OK
  // Returns Promise<boolean>
}
```

## 🔌 IPC Communication

The renderer calls `window.api.invoke(channel, ...args)`; channels are declared in `src/preload.ts`
and handled in `setupIPC()` in `src/main.ts`. Mutating handlers return the fresh `{ filters, folders }`
so the UI never needs a second round-trip. Errors are returned as codes (e.g. `invalidRegex`) and
translated with the `errors.*` keys.

```javascript
// renderer.js
const data = await window.api.invoke('filters:set-enabled', ids, true);
```

Main → renderer: `settings-changed` (e.g. when automatic mode is toggled from the tray).

## 🧪 Testing

```bash
npm test        # engine equivalence with 1.0.0, replacement templates, ReDoS timeout, storage, validation
npm run bench   # filtering speed compared with 1.0.0
```

## 📦 Building

### Development Build
```bash
npm run build
```

### Production Build
```bash
npm run package
```

### Build Options
```bash
# Windows installer
npm run package -- --win

# Portable version
npm run package -- --win portable

# Both
npm run package -- --win nsis portable
```

## 🔐 Code Signing (Optional)

1. **Get code signing certificate**
   - Windows: Authenticode certificate
   - Store in safe location

2. **Configure build:**
```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/cert.pfx",
      "certificatePassword": "your-password"
    }
  }
}
```

## 📋 Filter System

### Filter Structure
```javascript
{
  id: 'uuid',
  description: 'Credit Card',
  descriptionKey: 'filters.finance.creditCard', // For defaults
  category: 'Finance',
  pattern: '\d{4}-\d{4}-\d{4}-\d{4}',
  replacement: '****-****-****-****',
  useRegex: true,
  enabled: true,
  folder: 'optional-folder-id'
}
```

### Adding Default Filters

Edit `default-filters.json`:
```json
{
  "filters": [
    {
      "descriptionKey": "filters.custom.myFilter",
      "category": "Custom",
      "pattern": "pattern-here",
      "replacement": "replacement-here",
      "useRegex": true,
      "enabled": true
    }
  ]
}
```

Add translation keys to all locale files:
```json
{
  "filters": {
    "custom": {
      "myFilter": "My Filter Description"
    }
  }
}
```

## 🐛 Debugging

### Enable DevTools
```javascript
// main.ts
mainWindow.webContents.openDevTools();
```

### Logging
```javascript
// Renderer
console.log('[FILTER] Processing:', text);

// Main
console.log('[MAIN] Window created');
```

### Common Issues

**Filters not applying:**
- Check filter is enabled
- Check regex syntax
- Test in Test tab first

**UI not updating:**
- Check event listeners
- Verify IPC handlers
- Check for console errors

**Build fails:**
- Run `npm install` again
- Delete `node_modules` and reinstall
- Check TypeScript errors: `npx tsc`

## 🚢 Release Process

1. **Update version:**
```json
// package.json
{
  "version": "1.0.1"
}
```

2. **Update CHANGELOG.md**

3. **Build:**
```bash
npm run build
npm run package
```

4. **Test installer:**
```bash
.\release\ClipboardFilter-Setup-1.0.1.exe
```

5. **Create GitHub release:**
- Tag: `v1.0.1`
- Upload installer
- Write release notes

## 📚 Resources

- **Electron Docs:** https://www.electronjs.org/docs
- **TypeScript Handbook:** https://www.typescriptlang.org/docs
- **electron-builder:** https://www.electron.build

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Code Review Checklist
- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Translations added for new strings
- [ ] No console errors
- [ ] Performance impact minimal

---

**Maintainers:** @50bvd
**License:** MIT  
**Version:** 1.0.0

