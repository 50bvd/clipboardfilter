// ==================================================
// CLIPBOARDFILTER - app:// protocol
// Serves the interface from the application bundle instead of file://.
// The page can only read the app's own dist/ and assets/ files, never the
// rest of the disk (Electron security recommendation; allows disabling the
// GrantFileProtocolExtraPrivileges fuse).
// ==================================================

import { protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export const APP_SCHEME = 'app';
export const APP_HOST = 'bundle';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

const ROOT = path.join(__dirname, '..');
const ALLOWED_DIRS = ['dist', 'assets'];
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

/** Must be called before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true } }
  ]);
}

/** Resolves a request path to a file inside dist/ or assets/, or null. */
export function resolveAppPath(pathname: string): string | null {
  let rel: string;
  try { rel = decodeURIComponent(pathname); } catch { return null; }
  if (rel.includes('\0')) return null;
  const file = path.normalize(path.join(ROOT, rel));
  const inside = ALLOWED_DIRS.some(dir => file.startsWith(path.join(ROOT, dir) + path.sep));
  return inside && MIME[path.extname(file).toLowerCase()] ? file : null;
}

/** Must be called after the app is ready. */
export function handleAppScheme(): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const file = url.host === APP_HOST ? resolveAppPath(url.pathname) : null;
    if (!file) return new Response('Not found', { status: 404 });
    try {
      const data = await fs.promises.readFile(file);
      return new Response(data, {
        headers: {
          'Content-Type': MIME[path.extname(file).toLowerCase()],
          'X-Content-Type-Options': 'nosniff'
        }
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}
