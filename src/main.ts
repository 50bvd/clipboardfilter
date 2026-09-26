import {
  app, BrowserWindow, Tray, Menu, ipcMain, Notification, globalShortcut, nativeImage,
  nativeTheme, dialog, shell, session, IpcMainInvokeEvent, MenuItemConstructorOptions
} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { FilterManager, ValidationError, resolveDefaultFiltersPath } from './filterManager';
import { FilterRunner, FilterTimeoutError } from './filterRunner';
import { localeManager } from './localeManager';
import {
  getSessionInfo, readClipboardText, writeClipboardText, clearClipboard, clipboardBackendName,
  setAutoStart, wasOpenedAtLogin, getLaunchCommand
} from './platform';
import { simulatePaste, warmUpPaste, disposePaste, listPasteBackends, hasMacAccessibility } from './keyboardSimulator';
import { ClipboardWatcher } from './clipboardWatcher';
import { shouldUseGnomeShortcut, setGnomeShortcut, gnomeShortcutSupported, removeGnomeShortcut } from './gnomeShortcut';
import { isGnomeLikeDesktop } from './gnomeKeys';
import { UpdateInfo, checkForUpdates, defaultUpdateChannel, isTrustedReleaseUrl, RELEASES_PAGE } from './updateChecker';

const APP_ID = 'com.clipboardfilter.app';
const HELP_URL = 'https://github.com/50bvd/clipboardfilter#readme';
const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');
const IS_DEV = !app.isPackaged || process.argv.includes('--dev');
const MAX_IMPORT_SIZE = 5 * 1024 * 1024;
const UPDATE_FIRST_CHECK_MS = 15 * 1000;
const UPDATE_INTERVAL_MS = 12 * 60 * 60 * 1000;

type CliCommand = 'paste' | 'filter' | 'show' | 'toggle-auto' | null;

function parseCommand(argv: string[]): CliCommand {
  if (argv.includes('--paste')) return 'paste';
  if (argv.includes('--filter-clipboard')) return 'filter';
  if (argv.includes('--toggle-auto')) return 'toggle-auto';
  if (argv.includes('--show')) return 'show';
  return null;
}

function escapeHtml(text: string): string {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_\-./=:@%+,]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

class ClipboardFilterApp {
  private mainWindow: BrowserWindow | null = null;
  private aboutWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private filterManager!: FilterManager;
  private runner = new FilterRunner();
  private watcher = new ClipboardWatcher((text) => this.handleAutoFilter(text));
  private isQuitting = false;
  private currentShortcut = '';
  private shortcutRegistered = false;
  private shortcutMethod: 'electron' | 'gnome' | null = null;
  private shortcutsSuspended = false;
  private updateInfo: UpdateInfo = { status: 'idle', current: app.getVersion() };
  private updateTimer: NodeJS.Timeout | null = null;
  private notifiedUpdate: string | null = null;
  private pasteBusy = false;
  private clearTimer: NodeJS.Timeout | null = null;
  private lastPasteBackend: string | null = null;
  private lastWarningAt = 0;
  private lastAutoNotificationAt = 0;
  private backgroundNoticeShown = false;
  private markReady!: () => void;
  private readonly ready = new Promise<void>((resolve) => { this.markReady = resolve; });

  public async initialize(): Promise<void> {
    if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

    app.on('second-instance', async (_event, argv) => {
      await this.ready;
      const command = parseCommand(argv);
      if (command) this.runCommand(command);
      else this.createWindow();
    });

    app.on('before-quit', () => {
      this.isQuitting = true;
    });

    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
      this.watcher.stop();
      this.runner.dispose();
      disposePaste();
      this.filterManager?.flush();
    });

    // Keep running in the tray when the window is closed
    app.on('window-all-closed', () => { /* stay alive */ });

    app.on('activate', () => { this.ready.then(() => this.createWindow()); });

    this.hardenWebContents();

    await app.whenReady();
    this.hardenSession();

    const availableLocales = localeManager.getAvailableLocales();
    const configPath = path.join(app.getPath('userData'), 'config.json');
    const firstRun = !fs.existsSync(configPath);
    this.filterManager = new FilterManager(configPath, resolveDefaultFiltersPath(__dirname), availableLocales);
    if (firstRun) {
      this.filterManager.updateSettings({ language: localeManager.matchSystemLocale(app.getLocale()) });
    }

    const settings = this.filterManager.getSettings();
    localeManager.setLocale(settings.language);

    this.runner.setRules(this.filterManager.getFilters());
    this.filterManager.onRulesChanged(() => this.runner.setRules(this.filterManager.getFilters()));

    this.setupTray();
    this.setupIPC();
    this.registerShortcut(true).catch(e => console.error('[ClipboardFilter] Shortcut error:', e));
    this.scheduleUpdateChecks();
    if (settings.autoStart) setAutoStart(true); // refresh the path (AppImage may have moved)
    if (settings.autoFilter) this.watcher.start();
    if (settings.pasteMode === 'simulate') warmUpPaste();

    this.markReady();
    const hidden = wasOpenedAtLogin(process.argv);
    const command = parseCommand(process.argv);
    if (command) this.runCommand(command);
    else if (!this.tray || (!hidden && (!settings.startMinimized || firstRun))) this.createWindow();

    console.log(`[ClipboardFilter] Ready (${getSessionInfo().session}, ${getSessionInfo().desktop || 'n/a'})`);
  }

  // ==================== SECURITY ====================

  private hardenWebContents(): void {
    app.on('web-contents-created', (_e, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://')) shell.openExternal(url).catch(() => undefined);
        return { action: 'deny' };
      });
      contents.on('will-navigate', (event, url) => {
        if (url !== contents.getURL()) event.preventDefault();
      });
      contents.on('will-attach-webview', (event) => event.preventDefault());
    });
  }

  private hardenSession(): void {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
  }

  private isTrustedSender(event: IpcMainInvokeEvent): boolean {
    return !!this.mainWindow && event.sender === this.mainWindow.webContents
      && (event.senderFrame?.url || '').startsWith('file://');
  }

  // ==================== WINDOWS ====================

  private createWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) this.mainWindow.restore();
      this.mainWindow.show();
      this.mainWindow.focus();
      return;
    }

    this.mainWindow = new BrowserWindow({
      autoHideMenuBar: true,
      width: 980,
      height: 720,
      minWidth: 850,
      minHeight: 650,
      title: 'ClipboardFilter',
      icon: ICON_PATH,
      show: false,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d1117' : '#f5f5f5',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
        devTools: IS_DEV
      }
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer.html'));
    this.mainWindow.once('ready-to-show', () => this.mainWindow?.show());
    this.mainWindow.on('closed', () => { this.mainWindow = null; });
    this.mainWindow.on('close', (event) => {
      if (this.isQuitting) return;
      event.preventDefault();
      this.mainWindow?.hide();
      if (!this.backgroundNoticeShown) {
        this.backgroundNoticeShown = true;
        this.notify(localeManager.t('notifications.stillRunning'), localeManager.t('notifications.stillRunningBody'));
      }
    });
  }

  private showAbout(): void {
    if (this.aboutWindow) {
      this.aboutWindow.focus();
      return;
    }
    const settings = this.filterManager.getSettings();
    const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && nativeTheme.shouldUseDarkColors);
    const bgGradient = isDark ? 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    let iconBase64 = '';
    try { iconBase64 = fs.readFileSync(ICON_PATH).toString('base64'); } catch { /* ignore */ }

    this.aboutWindow = new BrowserWindow({
      width: 500,
      height: 600,
      title: localeManager.t('about.title'),
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      icon: ICON_PATH,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, devTools: false }
    });
    this.aboutWindow.on('closed', () => { this.aboutWindow = null; });

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Ubuntu, Cantarell, sans-serif; background: ${bgGradient};
    color: #fff; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
  .logo { width: 120px; height: 120px; margin-bottom: 24px; border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
  h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
  .version { font-size: 14px; opacity: 0.9; margin-bottom: 32px; }
  .card { background: rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; margin-bottom: 16px; width: 100%;
    max-width: 400px; border: 1px solid rgba(255,255,255,0.2); }
  .card h2 { font-size: 16px; margin-bottom: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; }
  .card p { font-size: 18px; line-height: 1.6; }
  .card strong { color: #ffd700; }
</style></head>
<body>
  ${iconBase64 ? `<img src="data:image/png;base64,${iconBase64}" class="logo" alt="ClipboardFilter">` : ''}
  <h1>ClipboardFilter</h1>
  <div class="version">Version ${escapeHtml(app.getVersion())}</div>
  <div class="card"><h2>${escapeHtml(localeManager.t('about.developer'))}</h2><p><strong>Loup LIGNON KRASNIQI</strong></p></div>
  <div class="card"><h2>Description</h2><p>${escapeHtml(localeManager.t('about.description'))}</p></div>
</body></html>`;

    this.aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }

  // ==================== TRAY ====================

  private setupTray(): void {
    try {
      const size = process.platform === 'linux' ? 32 : process.platform === 'darwin' ? 18 : 16;
      const image = nativeImage.createFromPath(ICON_PATH).resize({ width: size, height: size, quality: 'best' });
      this.tray = new Tray(image);
      this.updateTrayMenu();
      if (process.platform !== 'darwin') {
        this.tray.on('click', () => this.createWindow());
      }
      this.tray.on('double-click', () => this.createWindow());
    } catch (error) {
      console.error('[ClipboardFilter] System tray unavailable:', error);
      this.tray = null;
    }
  }

  private updateTrayMenu(): void {
    if (!this.tray) return;
    const settings = this.filterManager.getSettings();
    const template: MenuItemConstructorOptions[] = [];
    if (this.updateInfo.status === 'available') {
      template.push(
        { label: localeManager.t('menu.updateAvailable', { version: this.updateInfo.latest || '' }), click: () => this.openUpdatePage() },
        { type: 'separator' }
      );
    }
    template.push(
      { label: localeManager.t('menu.show'), click: () => this.createWindow() },
      { label: localeManager.t('menu.filterNow'), click: () => this.handleFilteredPaste(false) },
      {
        label: localeManager.t('menu.autoFilter'),
        type: 'checkbox',
        checked: settings.autoFilter,
        click: (item) => { this.applySettings({ autoFilter: item.checked }).catch(() => undefined); }
      },
      { type: 'separator' },
      { label: localeManager.t('menu.about'), click: () => this.showAbout() },
      { label: localeManager.t('menu.help'), click: () => shell.openExternal(HELP_URL).catch(() => undefined) },
      { type: 'separator' },
      { label: localeManager.t('menu.quit'), click: () => { this.isQuitting = true; app.quit(); } }
    );
    this.tray.setContextMenu(Menu.buildFromTemplate(template));
    this.tray.setToolTip(localeManager.t('app.trayTooltip'));
  }

  // ==================== SHORTCUT ====================

  private pasteCommandLine(): string {
    return getLaunchCommand(['--paste']).map(shellQuote).join(' ');
  }

  /**
   * Registers the paste shortcut:
   *  - GNOME on Wayland: as a GNOME custom shortcut running "clipboardfilter --paste"
   *    (apps cannot grab keys there, and the portal needs GNOME 48+ and an installed app);
   *  - elsewhere: Electron global shortcut (X11 grab, Windows, macOS, portal on KDE),
   *    falling back to a GNOME custom shortcut on GNOME-based desktops.
   */
  private async registerShortcut(force = false): Promise<boolean> {
    const shortcut = this.filterManager.getSettings().shortcutPaste || 'CommandOrControl+Shift+V';
    if (!force && shortcut === this.currentShortcut && this.shortcutRegistered) return true;

    if (this.currentShortcut && this.shortcutMethod === 'electron') {
      try { globalShortcut.unregister(this.currentShortcut); } catch { /* ignore */ }
    }

    let method: 'electron' | 'gnome' | null = null;
    if (await shouldUseGnomeShortcut() && await setGnomeShortcut(shortcut, this.pasteCommandLine())) {
      method = 'gnome';
    }
    if (!method) {
      let ok = false;
      try {
        ok = globalShortcut.register(shortcut, () => this.handleFilteredPaste(true));
      } catch (error) {
        console.error('[ClipboardFilter] Invalid shortcut:', shortcut, error);
      }
      if (ok) {
        method = 'electron';
      } else if (process.platform === 'linux' && isGnomeLikeDesktop(getSessionInfo().desktop)
        && await gnomeShortcutSupported() && await setGnomeShortcut(shortcut, this.pasteCommandLine())) {
        method = 'gnome';
      }
    }

    // Do not leave a stale GNOME shortcut behind when another method is used
    if (method !== 'gnome' && this.shortcutMethod === 'gnome') await removeGnomeShortcut();

    this.shortcutMethod = method;
    this.shortcutRegistered = method !== null;
    this.currentShortcut = method ? shortcut : '';
    if (method) console.log(`[ClipboardFilter] Shortcut ${shortcut} registered (${method})`);
    else console.error('[ClipboardFilter] Failed to register shortcut:', shortcut);
    return this.shortcutRegistered;
  }

  // ==================== UPDATES ====================

  private scheduleUpdateChecks(delay = UPDATE_FIRST_CHECK_MS): void {
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = null;
    if (!this.filterManager.getSettings().checkUpdates) return;
    this.updateTimer = setTimeout(async () => {
      await this.runUpdateCheck(false);
      this.scheduleUpdateChecks(UPDATE_INTERVAL_MS);
    }, delay);
    this.updateTimer.unref?.();
  }

  private async runUpdateCheck(manual: boolean): Promise<UpdateInfo> {
    const settings = this.filterManager.getSettings();
    const channel = settings.updateChannel === 'auto' ? defaultUpdateChannel() : settings.updateChannel;
    this.updateInfo = { ...this.updateInfo, status: 'checking' };
    this.mainWindow?.webContents.send('update-status', this.updateInfo);
    try {
      this.updateInfo = await checkForUpdates(channel === 'beta');
    } catch (error) {
      console.error('[ClipboardFilter] Update check failed:', error);
      this.updateInfo = { status: 'error', current: app.getVersion(), checkedAt: Date.now() };
    }

    const info = this.updateInfo;
    if (info.status === 'available' && !manual && info.latest !== this.notifiedUpdate) {
      this.notifiedUpdate = info.latest || null;
      if (Notification.isSupported()) {
        try {
          const n = new Notification({
            title: localeManager.t('notifications.updateTitle'),
            body: localeManager.t('notifications.updateBody', { version: info.latest || '' }),
            icon: ICON_PATH
          });
          n.on('click', () => this.openUpdatePage());
          n.show();
        } catch { /* ignore */ }
      }
    }
    this.updateTrayMenu();
    this.mainWindow?.webContents.send('update-status', info);
    return info;
  }

  private openUpdatePage(): void {
    const url = isTrustedReleaseUrl(this.updateInfo.url) ? this.updateInfo.url : RELEASES_PAGE;
    shell.openExternal(url).catch(() => undefined);
  }

  // ==================== FILTERING ====================

  private runCommand(command: CliCommand): void {
    // Ignore the GNOME shortcut while a new shortcut is being recorded
    if ((command === 'paste' || command === 'filter') && this.shortcutsSuspended) return;
    switch (command) {
      case 'paste': this.handleFilteredPaste(true); break;
      case 'filter': this.handleFilteredPaste(false); break;
      case 'toggle-auto': this.applySettings({ autoFilter: !this.filterManager.getSettings().autoFilter }).catch(() => undefined); break;
      case 'show': this.createWindow(); break;
    }
  }

  private async handleFilteredPaste(paste: boolean): Promise<void> {
    // Ignore re-entrant triggers (e.g. auto-repeat, or our own simulated keys)
    if (this.pasteBusy) return;
    this.pasteBusy = true;
    const settings = this.filterManager.getSettings();
    try {
      const original = await readClipboardText();
      if (!original) {
        if (!paste) this.notify(localeManager.t('notifications.clipboardEmpty'));
        return;
      }

      const result = await this.runner.filter(original);
      let current = original;
      if (result.count > 0) {
        await writeClipboardText(result.filtered);
        this.watcher.markWritten(result.filtered);
        current = result.filtered;
      }
      this.scheduleClipboardClear(current);

      const simulate = paste && settings.pasteMode === 'simulate';
      if (simulate) {
        const outcome = await simulatePaste();
        this.lastPasteBackend = outcome.backend;
        if (!outcome.ok) {
          this.warn(localeManager.t('notifications.pasteManually'), this.pasteHelpText());
          return;
        }
      }

      if (settings.notifications) {
        if (result.count > 0) {
          const title = simulate ? localeManager.t('notifications.pasteFiltered') : localeManager.t('notifications.copyFiltered');
          this.notify(title, localeManager.t('notifications.itemsFiltered', { count: result.count }));
        } else if (!simulate) {
          this.notify(localeManager.t('notifications.nothingFiltered'));
        }
      }
    } catch (error) {
      this.handleFilterError(error);
    } finally {
      setTimeout(() => { this.pasteBusy = false; }, 350);
    }
  }

  private async handleAutoFilter(text: string): Promise<void> {
    try {
      const result = await this.runner.filter(text);
      if (result.count === 0) return;
      await writeClipboardText(result.filtered);
      this.watcher.markWritten(result.filtered);
      this.scheduleClipboardClear(result.filtered);
      const now = Date.now();
      if (this.filterManager.getSettings().notifications && now - this.lastAutoNotificationAt > 3000) {
        this.lastAutoNotificationAt = now;
        this.notify(localeManager.t('notifications.copyFiltered'), localeManager.t('notifications.itemsFiltered', { count: result.count }));
      }
    } catch (error) {
      this.handleFilterError(error);
    }
  }

  private handleFilterError(error: unknown): void {
    if (error instanceof FilterTimeoutError) {
      const rule = this.filterManager.getFilters().find(f => f.id === error.ruleId);
      const name = rule ? (rule.description || localeManager.t(rule.descriptionKey || '')) : '?';
      this.warn(localeManager.t('notifications.filterTimeout'), localeManager.t('notifications.filterTimeoutBody', { name }));
    } else {
      console.error('[ClipboardFilter] Filtering failed:', error);
      this.warn(localeManager.t('errors.title'), localeManager.t('notifications.filterFailed'));
    }
  }

  private scheduleClipboardClear(content: string): void {
    const seconds = this.filterManager.getSettings().clearClipboardSeconds;
    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.clearTimer = null;
    if (!seconds) return;
    this.clearTimer = setTimeout(async () => {
      this.clearTimer = null;
      try {
        // Only clear if the user did not copy something else meanwhile
        if ((await readClipboardText()) === content) {
          await clearClipboard();
          this.watcher.markWritten('');
        }
      } catch { /* ignore */ }
    }, seconds * 1000);
  }

  private pasteHelpText(): string {
    const info = getSessionInfo();
    if (info.platform === 'darwin') return localeManager.t('notifications.macAccessibility');
    if (info.platform === 'linux') return localeManager.t(info.session === 'wayland' ? 'notifications.installWayland' : 'notifications.installX11');
    return localeManager.t('notifications.pasteManuallyBody');
  }

  // ==================== NOTIFICATIONS ====================

  private notify(title: string, body = '', force = false): void {
    if (!force && !this.filterManager.getSettings().notifications) return;
    if (!Notification.isSupported()) return;
    try {
      new Notification({ title, body, silent: true, icon: ICON_PATH }).show();
    } catch (error) {
      console.error('[ClipboardFilter] Notification failed:', error);
    }
  }

  /** Important warnings are always shown (rate-limited). */
  private warn(title: string, body: string): void {
    const now = Date.now();
    if (now - this.lastWarningAt < 5000) return;
    this.lastWarningAt = now;
    this.notify(title, body, true);
  }

  // ==================== SETTINGS ====================

  private async applySettings(input: any): Promise<{ settings: any; error?: string }> {
    const before = this.filterManager.getSettings();
    const after = this.filterManager.updateSettings(input);
    let error: string | undefined;

    if (after.shortcutPaste !== before.shortcutPaste) {
      if (!(await this.registerShortcut())) {
        // Keep the previous working shortcut
        this.filterManager.updateSettings({ shortcutPaste: before.shortcutPaste });
        await this.registerShortcut(true);
        error = 'shortcutUnavailable';
      }
    }
    if (after.language !== before.language) {
      localeManager.setLocale(after.language);
    }
    if (after.autoStart !== before.autoStart) setAutoStart(after.autoStart);
    if (after.autoFilter !== before.autoFilter) {
      if (after.autoFilter) this.watcher.start();
      else this.watcher.stop();
    }
    if (after.pasteMode === 'simulate' && before.pasteMode !== 'simulate') warmUpPaste();
    if (after.checkUpdates !== before.checkUpdates || after.updateChannel !== before.updateChannel) {
      this.scheduleUpdateChecks(after.checkUpdates && after.updateChannel !== before.updateChannel ? 1000 : UPDATE_FIRST_CHECK_MS);
    }
    if (after.clearClipboardSeconds === 0 && this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }

    this.updateTrayMenu();
    const settings = this.filterManager.getSettings();
    this.mainWindow?.webContents.send('settings-changed', settings);
    return { settings, error };
  }

  private getDiagnostics() {
    const info = getSessionInfo();
    return {
      ...info,
      version: app.getVersion(),
      electron: process.versions.electron,
      shortcut: { accelerator: this.filterManager.getSettings().shortcutPaste, registered: this.shortcutRegistered, method: this.shortcutMethod },
      pasteBackends: listPasteBackends(),
      lastPasteBackend: this.lastPasteBackend,
      clipboardBackend: clipboardBackendName(),
      watchMode: this.watcher.getMode(),
      trayAvailable: !!this.tray,
      accessibility: hasMacAccessibility(false),
      pasteCommand: this.pasteCommandLine(),
      configPath: path.join(app.getPath('userData'), 'config.json')
    };
  }

  // ==================== IPC ====================

  private handle(channel: string, fn: (...args: any[]) => any): void {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!this.isTrustedSender(event)) {
        console.warn(`[IPC] Rejected ${channel} from untrusted sender`);
        return { __error: 'forbidden' };
      }
      try {
        return await fn(...args);
      } catch (error) {
        if (error instanceof ValidationError) return { __error: error.code };
        if (error instanceof FilterTimeoutError) return { __error: 'filterTimeout' };
        console.error(`[IPC] ${channel} failed:`, error);
        return { __error: 'unknown' };
      }
    });
  }

  private setupIPC(): void {
    const fm = () => this.filterManager;
    const data = () => ({ filters: fm().getFilters(), folders: fm().getCustomFolders() });
    const str = (v: unknown) => (typeof v === 'string' ? v : '');

    this.handle('app:get-state', () => ({
      ...data(),
      settings: fm().getSettings(),
      translations: localeManager.getAll(),
      locales: localeManager.getAvailableLocales(),
      platform: process.platform
    }));
    this.handle('app:get-translations', () => localeManager.getAll());
    this.handle('app:diagnostics', () => this.getDiagnostics());
    this.handle('app:open-help', () => shell.openExternal(HELP_URL));
    this.handle('app:request-accessibility', () => hasMacAccessibility(true));

    // Updates
    this.handle('updates:status', () => this.updateInfo);
    this.handle('updates:check', () => this.runUpdateCheck(true));
    this.handle('updates:open', () => { this.openUpdatePage(); return true; });

    // Filters
    this.handle('filters:add', (filter) => { fm().addFilter(filter); return data(); });
    this.handle('filters:update', (id, updates) => { fm().updateFilter(str(id), updates); return data(); });
    this.handle('filters:set-enabled', (ids, enabled) => { fm().setFiltersEnabled(ids, !!enabled); return data(); });
    this.handle('filters:delete', (ids) => { fm().deleteFilters(ids); return data(); });
    this.handle('filters:copy-to-folder', (id, folderId) => { fm().copyFilterToFolder(str(id), str(folderId)); return data(); });
    this.handle('filters:move-to-folder', (id, folderId) => { fm().moveFilterToFolder(str(id), folderId ? str(folderId) : undefined); return data(); });
    this.handle('filters:test', async (text) => {
      if (typeof text !== 'string') return { filtered: '', count: 0, details: [] };
      return this.runner.filter(text, true);
    });

    // Folders
    this.handle('folders:add', (folder) => { fm().addCustomFolder(folder); return data(); });
    this.handle('folders:update', (id, updates) => { fm().updateCustomFolder(str(id), updates); return data(); });
    this.handle('folders:delete', (id) => { fm().deleteCustomFolder(str(id)); return data(); });

    // Settings
    this.handle('settings:update', async (settings) => {
      const result = await this.applySettings(settings);
      return { ...result, translations: localeManager.getAll() };
    });
    this.handle('shortcut:suspend', (suspended) => {
      this.shortcutsSuspended = !!suspended;
      globalShortcut.setSuspended(!!suspended);
      return true;
    });

    // Data management
    this.handle('data:reset-defaults', () => ({ count: fm().resetDefaults(), ...data() }));
    this.handle('data:delete-custom', () => ({ ...fm().deleteAllCustom(), ...data() }));

    // Templates
    this.handle('templates:export', async (meta) => {
      const filters = fm().exportCustomFilters();
      if (filters.length === 0) return { __error: 'noCustomFilters' };
      const name = str(meta?.name).trim().slice(0, 100) || 'Template';
      const template = {
        name,
        description: str(meta?.description).slice(0, 500) || 'Custom template',
        author: str(meta?.author).slice(0, 100) || 'Anonymous',
        version: '1.0.0',
        filters
      };
      const result = await dialog.showSaveDialog(this.mainWindow!, {
        defaultPath: `${name.replace(/[^a-z0-9_-]/gi, '_')}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (result.canceled || !result.filePath) return { saved: false };
      fs.writeFileSync(result.filePath, JSON.stringify(template, null, 2), 'utf-8');
      return { saved: true, count: filters.length };
    });
    this.handle('templates:import', (content) => {
      if (typeof content !== 'string' || content.length > MAX_IMPORT_SIZE) return { __error: 'importError' };
      let template: any;
      try { template = JSON.parse(content.replace(/^﻿/, '')); } catch { return { __error: 'importError' }; }
      if (!template || !Array.isArray(template.filters)) return { __error: 'importError' };
      const inputs = template.filters.map((f: any) => ({
        description: (f && (f.description || (f.descriptionKey ? localeManager.t(String(f.descriptionKey)) : ''))) || '',
        category: f?.category || 'Custom',
        pattern: f?.pattern,
        replacement: f?.replacement,
        useRegex: f?.useRegex !== false,
        caseSensitive: f?.caseSensitive === true,
        enabled: f?.enabled !== false
      }));
      return { ...fm().addFilters(inputs), ...data() };
    });
  }
}

// ==================== BOOTSTRAP ====================

// Must be acquired as early as possible: a second launch (e.g. from a desktop
// keyboard shortcut running "clipboardfilter --paste") only forwards its
// arguments to the running instance and exits immediately.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  if (process.platform === 'linux') {
    try { app.setDesktopName(`${APP_ID}.desktop`); } catch { /* older Electron */ }
  }
  const clipboardFilterApp = new ClipboardFilterApp();
  clipboardFilterApp.initialize().catch(error => {
    console.error('Failed to initialize app:', error);
    app.quit();
  });
}
