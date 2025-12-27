# ClipboardFilter - Developer Guide

## 🏗️ Architecture

### Technology Stack
- **Framework:** Electron 28+
- **Language:** TypeScript + JavaScript
- **UI:** HTML5 + CSS3 (no framework)
- **Build:** npm + electron-builder

### Project Structure
```
cp_filter/
├── src/
│   ├── main.ts              # Electron main process
│   ├── filterManager.ts     # Filter logic
│   ├── localeManager.ts     # i18n management
│   ├── keyboardSimulator.ts # Global shortcuts
│   ├── renderer.html        # UI markup
│   ├── renderer.js          # UI logic
│   └── styles.css           # Styling
├── locales/
│   ├── en.json              # English translations
│   ├── fr.json              # French translations
│   ├── de.json              # German translations
│   ├── es.json              # Spanish translations
│   └── it.json              # Italian translations
├── assets/
│   ├── icon.png             # App icon
│   └── icon.ico             # Windows icon
├── scripts/
│   ├── run.ps1              # Development script
│   ├── build.ps1            # Build script
│   └── package.ps1          # Package script
├── default-filters.json     # Default filter library
└── package.json             # Dependencies
```

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
async function loadFilters() {
  filters = await ipcRenderer.invoke('get-filters');
  renderFilters();
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

### Main → Renderer
```typescript
// main.ts
mainWindow.webContents.send('filters-updated', filters);

// renderer.js
ipcRenderer.on('filters-updated', (event, filters) => {
  this.filters = filters;
  renderFilters();
});
```

### Renderer → Main
```typescript
// main.ts
ipcMain.handle('get-filters', async () => {
  return await filterManager.getFilters();
});

// renderer.js
const filters = await ipcRenderer.invoke('get-filters');
```

## 🧪 Testing

### Manual Testing
Use `TEST-CHECKLIST.md` for comprehensive testing.

### Unit Testing (TODO)
```bash
npm test
```

### Integration Testing (TODO)
```bash
npm run test:integration
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

**Maintainers:** @your-github  
**License:** MIT  
**Version:** 1.0.0
