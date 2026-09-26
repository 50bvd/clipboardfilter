// ==================================================
// CLIPBOARDFILTER - GNOME custom shortcut (gsettings)
// Registers "clipboardfilter --paste" in GNOME Settings › Keyboard ›
// Custom Shortcuts. The running instance receives the command through the
// single-instance lock; if the app is not running, the shortcut starts it.
// ==================================================

import { findCommand, getSessionInfo, run } from './platform';
import {
  GNOME_BINDING_PATH, GNOME_BINDING_SCHEMA, GNOME_LIST_KEY, GNOME_SCHEMA,
  gvariantString, gvariantStringArray, isGnomeLikeDesktop, parseGVariantStringArray, toGnomeAccelerator
} from './gnomeKeys';

let schemaAvailable: boolean | null = null;

/** GNOME custom shortcuts are used on GNOME-based Wayland sessions (outside Flatpak). */
export async function shouldUseGnomeShortcut(): Promise<boolean> {
  const info = getSessionInfo();
  if (info.platform !== 'linux' || info.isFlatpak || info.session !== 'wayland') return false;
  if (!isGnomeLikeDesktop(info.desktop)) return false;
  return gnomeShortcutSupported();
}

export async function gnomeShortcutSupported(): Promise<boolean> {
  if (schemaAvailable !== null) return schemaAvailable;
  const gsettings = findCommand('gsettings');
  schemaAvailable = !!gsettings && (await run(gsettings, ['list-keys', GNOME_SCHEMA])).code === 0;
  return schemaAvailable;
}

async function gset(args: string[]): Promise<boolean> {
  const r = await run(findCommand('gsettings')!, args);
  if (r.code !== 0) console.error('[GNOME shortcut] gsettings failed:', args.join(' '), r.stderr.trim());
  return r.code === 0;
}

/** Creates or updates the custom shortcut. Returns false if it could not be set. */
export async function setGnomeShortcut(accelerator: string, command: string): Promise<boolean> {
  if (!(await gnomeShortcutSupported())) return false;
  const binding = toGnomeAccelerator(accelerator);
  if (!binding) return false;

  const ok = await gset(['set', GNOME_BINDING_SCHEMA, 'name', gvariantString('ClipboardFilter')])
    && await gset(['set', GNOME_BINDING_SCHEMA, 'command', gvariantString(command)])
    && await gset(['set', GNOME_BINDING_SCHEMA, 'binding', gvariantString(binding)]);
  if (!ok) return false;

  const current = await run(findCommand('gsettings')!, ['get', GNOME_SCHEMA, GNOME_LIST_KEY]);
  if (current.code !== 0) return false;
  const paths = parseGVariantStringArray(current.stdout);
  if (!paths.includes(GNOME_BINDING_PATH)) {
    return gset(['set', GNOME_SCHEMA, GNOME_LIST_KEY, gvariantStringArray([...paths, GNOME_BINDING_PATH])]);
  }
  return true;
}

export async function removeGnomeShortcut(): Promise<void> {
  if (!(await gnomeShortcutSupported())) return;
  const current = await run(findCommand('gsettings')!, ['get', GNOME_SCHEMA, GNOME_LIST_KEY]);
  if (current.code !== 0) return;
  const paths = parseGVariantStringArray(current.stdout);
  if (paths.includes(GNOME_BINDING_PATH)) {
    await gset(['set', GNOME_SCHEMA, GNOME_LIST_KEY, gvariantStringArray(paths.filter(p => p !== GNOME_BINDING_PATH))]);
  }
  await gset(['reset-recursively', GNOME_BINDING_SCHEMA]);
}
