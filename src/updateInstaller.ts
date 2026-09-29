// ==================================================
// CLIPBOARDFILTER - In-app update download and installation
// Downloads the installer matching how the app was installed, checks its
// SHA-256 against the SHA256SUMS.txt file of the same GitHub release, then
// installs it:
//  - Windows installer : silent NSIS update, the app restarts by itself
//  - Windows portable  : new .exe saved next to the current one
//  - AppImage          : the AppImage file is replaced in place
//  - .deb/.rpm/.pacman : system package manager through pkexec (password prompt)
//  - macOS             : the .app bundle is replaced from the .dmg
// Only files of this repository's GitHub releases can be downloaded.
// ==================================================

import { app, net } from 'electron';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findCommand, run } from './platform';

export const DOWNLOAD_PREFIX = 'https://github.com/50bvd/clipboardfilter/releases/download/';
const CHECKSUMS_FILE = 'SHA256SUMS.txt';
const MAX_DOWNLOAD = 1024 * 1024 * 1024;

export type InstallKind = 'nsis' | 'portable' | 'appimage' | 'deb' | 'rpm' | 'pacman' | 'dmg';

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
}

export type DownloadPhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'installing' | 'error';

export interface DownloadState {
  phase: DownloadPhase;
  version?: string;
  received: number;
  total: number;
  bytesPerSecond: number;
  /** error code, translated by the interface */
  error?: string;
  /** false when the app cannot install this update by itself (release page instead) */
  supported: boolean;
}

export class UpdateError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Only files of this repository's releases may be downloaded. */
export function isTrustedDownloadUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(DOWNLOAD_PREFIX)
    && !url.includes('..') && !/[\s"'<>\\?#]/.test(url);
}

/** Name of the release file for an install kind (electron-builder naming). */
export function assetNameFor(kind: InstallKind, version: string, arch: string = process.arch): string | null {
  const v = version.replace(/^v/, '');
  switch (kind) {
    case 'nsis': return `ClipboardFilter.Setup.${v}.exe`;
    case 'portable': return `ClipboardFilter.${v}.exe`;
    case 'appimage': return arch === 'x64' ? `ClipboardFilter-${v}.AppImage` : null;
    case 'deb': return arch === 'x64' ? `clipboard-filter_${v}_amd64.deb` : null;
    case 'rpm': return arch === 'x64' ? `clipboard-filter-${v}.x86_64.rpm` : null;
    case 'pacman': return arch === 'x64' ? `clipboard-filter-${v}.pacman` : null;
    case 'dmg': return arch === 'arm64' ? `ClipboardFilter-${v}-arm64.dmg` : `ClipboardFilter-${v}.dmg`;
  }
}

/** GitHub replaces spaces with dots in the names of uploaded files. */
function publishedName(name: string): string {
  return name.trim().replace(/ /g, '.');
}

/** Parses a `sha256sum` output: file name (as published) -> lowercase hash. */
export function parseChecksums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(line.trim());
    if (m) sums.set(publishedName(m[2]), m[1].toLowerCase());
  }
  return sums;
}

let cachedKind: InstallKind | null | undefined;

/** How this copy of the app was installed, or null if it cannot update itself. */
export async function detectInstallKind(): Promise<InstallKind | null> {
  if (cachedKind !== undefined) return cachedKind;
  let kind: InstallKind | null = null;
  if (app.isPackaged) {
    if (process.platform === 'win32') {
      kind = process.env.PORTABLE_EXECUTABLE_FILE ? 'portable' : 'nsis';
    } else if (process.platform === 'darwin') {
      kind = macBundlePath() ? 'dmg' : null;
    } else if (process.platform === 'linux') {
      if (process.env.APPIMAGE) {
        kind = 'appimage';
      } else {
        const owners: Array<[InstallKind, string, string[]]> = [
          ['deb', 'dpkg', ['-S']],
          ['rpm', 'rpm', ['-qf']],
          ['pacman', 'pacman', ['-Qo']]
        ];
        for (const [k, cmd, args] of owners) {
          const bin = findCommand(cmd);
          if (bin && (await run(bin, [...args, process.execPath], { timeoutMs: 5000 })).code === 0) {
            kind = k;
            break;
          }
        }
      }
    }
  }
  cachedKind = kind;
  return kind;
}

function macBundlePath(): string | null {
  const bundle = path.resolve(process.execPath, '..', '..', '..');
  return bundle.endsWith('.app') ? bundle : null;
}

// ---------- Download ----------

export class UpdateDownloader {
  private state: DownloadState = { phase: 'idle', received: 0, total: 0, bytesPerSecond: 0, supported: true };
  private abort: AbortController | null = null;
  private file: string | null = null;
  private kind: InstallKind | null = null;

  constructor(private readonly onChange: (state: DownloadState) => void) {}

  public getState(): DownloadState {
    return { ...this.state };
  }

  public async refreshSupport(version: string | undefined, assets: ReleaseAsset[] | undefined): Promise<DownloadState> {
    const kind = await detectInstallKind();
    const name = kind && version ? assetNameFor(kind, version) : null;
    const supported = !!name && !!assets?.some(a => a.name === name) && !!assets?.some(a => a.name === CHECKSUMS_FILE);
    if (this.state.version !== version && this.state.phase !== 'downloading' && this.state.phase !== 'installing') {
      this.reset();
    }
    this.set({ supported });
    return this.getState();
  }

  public async download(version: string, assets: ReleaseAsset[]): Promise<void> {
    if (this.state.phase === 'downloading' || this.state.phase === 'verifying' || this.state.phase === 'installing') return;
    if (this.state.phase === 'ready' && this.state.version === version && this.file) return;
    this.reset();

    const kind = await detectInstallKind();
    const name = kind ? assetNameFor(kind, version) : null;
    const asset = assets.find(a => a.name === name);
    const sumsAsset = assets.find(a => a.name === CHECKSUMS_FILE);
    if (!kind || !asset || !sumsAsset) {
      this.set({ phase: 'error', error: 'unsupported', supported: false, version });
      return;
    }

    this.kind = kind;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.set({ phase: 'downloading', version, received: 0, total: asset.size, bytesPerSecond: 0, supported: true });

    let dir: string | null = null;
    try {
      const sums = parseChecksums(await (await this.fetch(sumsAsset.url, signal)).text());
      const expected = sums.get(asset.name);
      if (!expected) throw new UpdateError('checksumMissing');

      dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clipboardfilter-update-'));
      const file = path.join(dir, asset.name);
      const actual = await this.save(asset, file, signal);

      this.set({ phase: 'verifying' });
      if (actual !== expected) throw new UpdateError('checksumMismatch');
      this.file = file;
      this.set({ phase: 'ready', bytesPerSecond: 0 });
    } catch (error) {
      if (dir) fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
      if (signal.aborted) {
        this.reset();
        this.onChange(this.getState());
        return;
      }
      console.error('[Update] Download failed:', error);
      this.set({ phase: 'error', error: error instanceof UpdateError ? error.code : 'downloadFailed', bytesPerSecond: 0 });
    } finally {
      this.abort = null;
    }
  }

  public cancel(): void {
    this.abort?.abort();
  }

  /**
   * Installs the downloaded update. Returns true when the app must quit
   * (the installer or the new version takes over).
   */
  public async install(): Promise<boolean> {
    if (this.state.phase !== 'ready' || !this.file || !this.kind) return false;
    const file = this.file;
    this.set({ phase: 'installing' });
    try {
      await installFile(this.kind, file);
      return true;
    } catch (error) {
      console.error('[Update] Installation failed:', error);
      this.set({ phase: 'error', error: error instanceof UpdateError ? error.code : 'installFailed' });
      return false;
    }
  }

  private async fetch(url: string, signal: AbortSignal): Promise<Response> {
    if (!isTrustedDownloadUrl(url)) throw new UpdateError('downloadFailed');
    const response = await net.fetch(url, {
      headers: { 'User-Agent': `ClipboardFilter/${app.getVersion()}` },
      signal
    });
    if (!response.ok || !response.body) throw new UpdateError('downloadFailed');
    return response;
  }

  /** Streams the file to disk and returns its SHA-256. */
  private async save(asset: ReleaseAsset, file: string, signal: AbortSignal): Promise<string> {
    const response = await this.fetch(asset.url, signal);
    const total = Number(response.headers.get('content-length')) || asset.size;
    if (total > MAX_DOWNLOAD) throw new UpdateError('downloadFailed');

    const hash = createHash('sha256');
    const out = fs.createWriteStream(file, { mode: 0o600 });
    const reader = response.body!.getReader();
    const started = Date.now();
    let received = 0;
    let lastReport = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_DOWNLOAD) throw new UpdateError('downloadFailed');
        hash.update(value);
        if (!out.write(value)) await new Promise<void>(r => out.once('drain', () => r()));
        const now = Date.now();
        if (now - lastReport > 150) {
          lastReport = now;
          const seconds = Math.max(0.001, (now - started) / 1000);
          this.set({ received, total, bytesPerSecond: Math.round(received / seconds) });
        }
      }
    } finally {
      await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    }
    if (asset.size && received !== asset.size) throw new UpdateError('downloadFailed');
    this.set({ received, total: received });
    return hash.digest('hex');
  }

  private reset(): void {
    if (this.file) fs.promises.rm(path.dirname(this.file), { recursive: true, force: true }).catch(() => undefined);
    this.file = null;
    this.state = { phase: 'idle', received: 0, total: 0, bytesPerSecond: 0, supported: this.state.supported };
  }

  private set(patch: Partial<DownloadState>): void {
    this.state = { ...this.state, ...patch };
    if (patch.phase !== 'error') delete this.state.error;
    if (patch.error) this.state.error = patch.error;
    this.onChange(this.getState());
  }
}

// ---------- Installation ----------

/** Launch options the new version must keep (e.g. AppImages started with --no-sandbox). */
function relaunchArgs(): string[] {
  return process.argv.slice(1).filter(a => a === '--no-sandbox');
}

async function installFile(kind: InstallKind, file: string): Promise<void> {
  switch (kind) {
    case 'nsis': return installNsis(file);
    case 'portable': return installPortable(file);
    case 'appimage': return installAppImage(file);
    case 'deb':
    case 'rpm':
    case 'pacman': return installPackage(kind, file);
    case 'dmg': return installMac(file);
  }
}

function installNsis(file: string): void {
  // Silent update of the existing installation, then the installer restarts the app
  const child = spawn(file, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: false });
  child.on('error', (error) => console.error('[Update] Could not start the installer:', error));
  child.unref();
}

async function installPortable(file: string): Promise<void> {
  const current = process.env.PORTABLE_EXECUTABLE_FILE;
  if (!current) throw new UpdateError('installFailed');
  const target = path.join(path.dirname(current), path.basename(file));
  try {
    await fs.promises.copyFile(file, target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new UpdateError(code === 'EACCES' || code === 'EPERM' ? 'noPermission' : 'installFailed');
  }
  app.relaunch({ execPath: target, args: relaunchArgs() });
}

async function installAppImage(file: string): Promise<void> {
  const target = process.env.APPIMAGE;
  if (!target) throw new UpdateError('installFailed');
  // Copy next to the target first, so that the final rename is atomic
  const staging = path.join(path.dirname(target), `.${path.basename(target)}.update`);
  try {
    await fs.promises.copyFile(file, staging);
    await fs.promises.chmod(staging, 0o755);
    await fs.promises.rename(staging, target);
  } catch (error) {
    await fs.promises.rm(staging, { force: true }).catch(() => undefined);
    throw new UpdateError((error as NodeJS.ErrnoException).code === 'EACCES' ? 'noPermission' : 'installFailed');
  }
  app.relaunch({ execPath: target, args: relaunchArgs() });
}

function packageCommand(kind: 'deb' | 'rpm' | 'pacman', file: string): string[] | null {
  const pick = (...candidates: Array<[string, string[]]>): string[] | null => {
    for (const [cmd, args] of candidates) {
      const bin = findCommand(cmd);
      if (bin) return [bin, ...args];
    }
    return null;
  };
  switch (kind) {
    case 'deb': return pick(['apt-get', ['install', '-y', '--allow-downgrades', file]], ['dpkg', ['-i', file]]);
    case 'rpm': return pick(['dnf', ['install', '-y', file]], ['zypper', ['--non-interactive', 'install', '--allow-unsigned-rpm', file]], ['rpm', ['-U', file]]);
    case 'pacman': return pick(['pacman', ['-U', '--noconfirm', file]]);
  }
}

async function installPackage(kind: 'deb' | 'rpm' | 'pacman', file: string): Promise<void> {
  const pkexec = findCommand('pkexec');
  const command = packageCommand(kind, file);
  if (!pkexec || !command) throw new UpdateError('noPkexec');
  // The package manager runs as root after the system password prompt
  const result = await run(pkexec, command, { timeoutMs: 15 * 60 * 1000 });
  if (result.code === 126 || result.code === 127) throw new UpdateError('installCancelled');
  if (result.code !== 0) {
    console.error('[Update] Package manager failed:', result.stderr.slice(-2000));
    throw new UpdateError('installFailed');
  }
  app.relaunch({ args: relaunchArgs() });
}

async function installMac(file: string): Promise<void> {
  const bundle = macBundlePath();
  if (!bundle) throw new UpdateError('installFailed');
  const mount = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clipboardfilter-dmg-'));
  const staging = `${bundle}.update`;
  let attached = false;
  try {
    const attach = await run('/usr/bin/hdiutil', ['attach', '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mount, file], { timeoutMs: 120000 });
    if (attach.code !== 0) throw new UpdateError('installFailed');
    attached = true;
    const appName = (await fs.promises.readdir(mount)).find(n => n.endsWith('.app'));
    if (!appName) throw new UpdateError('installFailed');
    await fs.promises.rm(staging, { recursive: true, force: true });
    const copy = await run('/usr/bin/ditto', [path.join(mount, appName), staging], { timeoutMs: 300000 });
    if (copy.code !== 0) throw new UpdateError(copy.stderr.includes('ermission') ? 'noPermission' : 'installFailed');
  } finally {
    if (attached) await run('/usr/bin/hdiutil', ['detach', mount, '-force'], { timeoutMs: 60000 });
    await fs.promises.rm(mount, { recursive: true, force: true }).catch(() => undefined);
  }
  // A running bundle can be renamed: swap the old and new versions
  const old = `${bundle}.old`;
  try {
    await fs.promises.rm(old, { recursive: true, force: true });
    await fs.promises.rename(bundle, old);
    await fs.promises.rename(staging, bundle);
  } catch (error) {
    if (!fs.existsSync(bundle) && fs.existsSync(old)) await fs.promises.rename(old, bundle).catch(() => undefined);
    await fs.promises.rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw new UpdateError((error as NodeJS.ErrnoException).code === 'EACCES' ? 'noPermission' : 'installFailed');
  }
  fs.promises.rm(old, { recursive: true, force: true }).catch(() => undefined);
  app.relaunch({ execPath: path.join(bundle, 'Contents', 'MacOS', path.basename(process.execPath)), args: relaunchArgs() });
}
