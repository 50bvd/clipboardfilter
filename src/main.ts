import { app, BrowserWindow, Tray, Menu, clipboard, ipcMain, Notification, globalShortcut } from 'electron';
import * as path from 'path';
import { FilterManager } from './filterManager';
import { localeManager } from './localeManager';

class ClipboardFilterApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private filterManager: FilterManager;
  private isQuitting: boolean = false;
  private currentShortcut: string = '';

  constructor() {
    this.filterManager = new FilterManager();
    const settings = this.filterManager.getSettings();
    localeManager.setLocale(settings.language);
  }

  public async initialize(): Promise<void> {
    console.log('[ClipboardFilter] Starting application...');
    await app.whenReady();
    console.log('[ClipboardFilter] Electron ready');

    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      console.log('[ClipboardFilter] Another instance running, exiting...');
      app.quit();
      return;
    }

    app.on('second-instance', () => {
      console.log('[ClipboardFilter] Second instance detected');
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
      } else {
        this.createWindow();
      }
    });

    this.setupTray();
    this.setupIPC();
    this.setupGlobalShortcuts();
    console.log('[ClipboardFilter] Initialization complete');

    app.on('window-all-closed', (e: Event) => {
      e.preventDefault();
    });

    app.on('activate', () => {
      if (!this.mainWindow) {
        this.createWindow();
      }
    });
  }

  private setupTray(): void {
    const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    this.tray = new Tray(iconPath);
    
    this.updateTrayMenu();
    
    this.tray.on('double-click', () => {
      this.createWindow();
    });
  }

  private createWindow(): void {
    console.log('[ClipboardFilter] Creating window...');
    if (this.mainWindow) {
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.focus();
      return;
    }

    this.mainWindow = new BrowserWindow({
      autoHideMenuBar: true,
      width: 950,
      height: 700,
      minWidth: 850,
      minHeight: 650,
      title: 'ClipboardFilter - Configuration',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: true
      },
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      show: false
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }

  private showAbout(): void {
    console.log('[ClipboardFilter] Opening About window...');
    const devLabel = localeManager.t('about.developer');
    const descLabel = localeManager.t('about.description');
    const settings = this.filterManager.getSettings();
    
    // DÃ©terminer le thÃ¨me Ã  utiliser
    let isDark = false;
    if (settings.theme === 'dark') {
      isDark = true;
    } else if (settings.theme === 'auto') {
      const { nativeTheme } = require('electron');
      isDark = nativeTheme.shouldUseDarkColors;
    }
    
    // Couleurs du fond selon le thÃ¨me
    const bgGradient = isDark ? 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    
    // Charger l'icÃ´ne PNG en base64
    const fs = require('fs');
    const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    const iconBase64 = fs.readFileSync(iconPath).toString('base64');
    
    const aboutWindow = new BrowserWindow({
      width: 500,
      height: 600,
      title: localeManager.t('about.title'),
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: ${bgGradient};
            color: #fff;
            padding: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .logo {
            width: 120px;
            height: 120px;
            margin-bottom: 24px;
            border-radius: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          }
          h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .version {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 32px;
          }
          .card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 16px;
            width: 100%;
            max-width: 400px;
            border: 1px solid rgba(255,255,255,0.2);
          }
          .card h2 {
            font-size: 16px;
            margin-bottom: 12px;
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .card p {
            font-size: 18px;
            line-height: 1.6;
          }
          .card strong {
            color: #ffd700;
          }
          a {
            color: #ffd700;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <img src="data:image/png;base64,${iconBase64}" class="logo" alt="ClipboardFilter">
        <h1>ClipboardFilter</h1>
        <div class="version">Version 1.0.0</div>
        
        <div class="card">
          <h2>${devLabel}</h2>
          <p><strong>Loup LIGNON KRASNIQI</strong></p>
        </div>
        
        <div class="card">
          <h2>Description</h2>
          <p>${descLabel}</p>
        </div>

      </body>
      </html>
    `;

    aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }

  private setupIPC(): void {
    console.log('[ClipboardFilter] Setting up IPC handlers...');
    // Filters
    ipcMain.handle('get-filters', () => {
      const filters = this.filterManager.getFilters();
      console.log(`[IPC] get-filters: ${filters.length} filters`);
      return filters;
    });

    ipcMain.handle('get-categories', () => {
      return this.filterManager.getCategories();
    });

    ipcMain.handle('add-filter', (event, filter) => {
      console.log(`[IPC] add-filter: ${filter.description}`);
      return this.filterManager.addFilter(filter);
    });

    ipcMain.handle('update-filter', (event, id, updates) => {
      console.log(`[IPC] update-filter: ${id}`);
      this.filterManager.updateFilter(id, updates);
    });

    ipcMain.handle('delete-filter', (event, id) => {
      console.log(`[IPC] delete-filter: ${id}`);
      this.filterManager.deleteFilter(id);
    });

    ipcMain.handle('filter-text', (event, text) => {
      const result = this.filterManager.filterText(text);
      console.log(`[IPC] filter-text: ${text.length} chars -> ${result.count} matches`);
      return result;
    });

    // Settings
    ipcMain.handle('get-settings', () => {
      return this.filterManager.getSettings();
    });

    ipcMain.handle('update-settings', (event, settings) => {
      this.filterManager.updateSettings(settings);
      // Re-register shortcut if changed
      if (settings.shortcutPaste) {
        this.registerShortcut();
      }
      if (settings.language) {
        localeManager.setLocale(settings.language);
        this.updateTrayMenu();
      }
      return this.filterManager.getSettings();
    });

    // Locales
    ipcMain.handle('get-locales', () => {
      return localeManager.getAvailableLocales();
    });

    ipcMain.handle('get-translation', (event, key, params) => {
      return localeManager.t(key, params);
    });

    ipcMain.handle('get-all-translations', () => {
      const locale = localeManager.getLocale();
      const fs = require('fs');
      const localePath = path.join(__dirname, '..', 'locales', `${locale}.json`);
      
      try {
        const content = fs.readFileSync(localePath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        const enPath = path.join(__dirname, '..', 'locales', 'en.json');
        return JSON.parse(fs.readFileSync(enPath, 'utf-8'));
      }
    });

    // Custom folders
    ipcMain.handle('get-custom-folders', () => {
      return this.filterManager.getCustomFolders();
    });

    ipcMain.handle('add-custom-folder', (event, folder) => {
      return this.filterManager.addCustomFolder(folder);
    });

    ipcMain.handle('update-custom-folder', (event, id, updates) => {
      this.filterManager.updateCustomFolder(id, updates);
    });

    ipcMain.handle('delete-custom-folder', (event, id) => {
      this.filterManager.deleteCustomFolder(id);
    });

    ipcMain.handle('move-filter-to-folder', (event, filterId, folderId) => {
      this.filterManager.moveFilterToFolder(filterId, folderId);
    });
  }

  private setupGlobalShortcuts(): void {
    this.registerShortcut();
    
    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
    });
  }

  private registerShortcut(): void {
    const settings = this.filterManager.getSettings();
    const shortcut = settings.shortcutPaste || 'CommandOrControl+Shift+V';
    
    // If same shortcut, no need to re-register
    if (this.currentShortcut === shortcut) {
      console.log(`[ClipboardFilter] Shortcut unchanged: ${shortcut}`);
      return;
    }
    
    // Unregister old shortcut if exists
    if (this.currentShortcut && globalShortcut.isRegistered(this.currentShortcut)) {
      console.log(`[ClipboardFilter] Unregistering old shortcut: ${this.currentShortcut}`);
      globalShortcut.unregister(this.currentShortcut);
    }
    
    // Register new shortcut
    console.log(`[ClipboardFilter] Registering global shortcut: ${shortcut}`);
    
    const ret = globalShortcut.register(shortcut, () => {
      console.log('[ClipboardFilter] Shortcut triggered!');
      this.handleFilteredPaste();
    });

    if (ret) {
      this.currentShortcut = shortcut;
      console.log(`[ClipboardFilter] Shortcut registered: ${shortcut}`);
    } else {
      console.error('[ClipboardFilter] Failed to register shortcut:', shortcut);
      this.currentShortcut = '';
    }
  }

  private async handleFilteredPaste(): Promise<void> {
    try {
      // Lire le contenu du presse-papiers
      const originalText = clipboard.readText();
      
      if (!originalText) {
        console.log('[ClipboardFilter] Clipboard is empty');
        return;
      }

      console.log(`[ClipboardFilter] Processing ${originalText.length} characters...`);

      // Filtrer le texte
      const result = this.filterManager.filterText(originalText);
      
      console.log(`[ClipboardFilter] Filtered: ${result.count} matches found`);

      // Remplacer le contenu du presse-papiers
      clipboard.writeText(result.filtered);

      // Simuler Ctrl+V pour coller
      const { simulate } = require('./keyboardSimulator');
      await simulate('v', ['control']);

      // Notification optionnelle
      if (this.filterManager.getSettings().notifications && result.count > 0) {
        const notification = new Notification({
          title: localeManager.t('notifications.pasteFiltered'),
          body: localeManager.t('notifications.itemsFiltered', { count: result.count.toString() }),
          silent: true
        });
        notification.show();
      }
    } catch (error) {
      console.error('[ClipboardFilter] Error during filtered paste:', error);
    }
  }

  private updateTrayMenu(): void {
    if (this.tray) {
      const contextMenu = Menu.buildFromTemplate([
        {
          label: localeManager.t('menu.show'),
          click: () => this.createWindow()
        },
        { type: 'separator' },
        {
          label: localeManager.t('menu.about'),
          click: () => this.showAbout()
        },
        {
          label: 'Aide',
          click: () => {
            require('electron').shell.openExternal('https://github.com');
          }
        },
        { type: 'separator' },
        {
          label: localeManager.t('menu.quit'),
          click: () => {
            this.isQuitting = true;
            app.quit();
          }
        }
      ]);
      this.tray.setContextMenu(contextMenu);
      this.tray.setToolTip(localeManager.t('app.trayTooltip'));
    }
  }
}

const clipboardFilterApp = new ClipboardFilterApp();
clipboardFilterApp.initialize().catch(error => {
  console.error('Failed to initialize app:', error);
  app.quit();
});


