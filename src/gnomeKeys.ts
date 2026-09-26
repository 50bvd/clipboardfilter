// ==================================================
// CLIPBOARDFILTER - GNOME custom keyboard shortcut helpers (pure functions)
// On GNOME Wayland, applications cannot grab keys and the GlobalShortcuts
// portal only exists since GNOME 48 (and rejects apps without an installed
// .desktop file). A custom shortcut in GNOME Settings, running
// "clipboardfilter --paste", works on every GNOME version.
// ==================================================

export const GNOME_SCHEMA = 'org.gnome.settings-daemon.plugins.media-keys';
export const GNOME_LIST_KEY = 'custom-keybindings';
export const GNOME_BINDING_PATH = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/clipboardfilter/';
export const GNOME_BINDING_SCHEMA = `${GNOME_SCHEMA}.custom-keybinding:${GNOME_BINDING_PATH}`;

const MODIFIERS: Record<string, string> = {
  CommandOrControl: '<Control>',
  CmdOrCtrl: '<Control>',
  Control: '<Control>',
  Ctrl: '<Control>',
  Alt: '<Alt>',
  Option: '<Alt>',
  AltGr: '<Mod5>',
  Shift: '<Shift>',
  Super: '<Super>',
  Meta: '<Super>',
  Command: '<Super>',
  Cmd: '<Super>'
};

const KEYS: Record<string, string> = {
  Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right',
  Return: 'Return', Enter: 'Return', Space: 'space', Tab: 'Tab',
  Backspace: 'BackSpace', Delete: 'Delete', Insert: 'Insert',
  Home: 'Home', End: 'End', PageUp: 'Page_Up', PageDown: 'Page_Down', Escape: 'Escape'
};

/** Converts an Electron accelerator ("CommandOrControl+Shift+V") to GNOME syntax ("<Control><Shift>v"). */
export function toGnomeAccelerator(accelerator: string): string | null {
  const parts = String(accelerator || '').split('+').filter(Boolean);
  if (parts.length === 0) return null;
  const key = parts.pop()!;
  let out = '';
  for (const m of parts) {
    const g = MODIFIERS[m];
    if (!g) return null;
    if (!out.includes(g)) out += g;
  }
  let keysym: string | null = null;
  if (/^[A-Za-z]$/.test(key)) keysym = key.toLowerCase();
  else if (/^[0-9]$/.test(key)) keysym = key;
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) keysym = key;
  else if (/^num[0-9]$/.test(key)) keysym = `KP_${key.slice(3)}`;
  else if (KEYS[key]) keysym = KEYS[key];
  return keysym ? out + keysym : null;
}

/** Parses the output of `gsettings get … custom-keybindings` ("@as []" or "['/a/', '/b/']"). */
export function parseGVariantStringArray(text: string): string[] {
  const out: string[] = [];
  const re = /'((?:[^'\\]|\\.)*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1].replace(/\\(.)/g, '$1'));
  return out;
}

/** Quotes a string as a GVariant text literal. */
export function gvariantString(value: string): string {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function gvariantStringArray(values: string[]): string {
  return values.length === 0 ? '@as []' : `[${values.map(gvariantString).join(', ')}]`;
}

/** True for desktops that use GNOME's media-keys custom shortcuts. */
export function isGnomeLikeDesktop(desktop: string): boolean {
  return /gnome|unity|pantheon|budgie/i.test(desktop || '');
}
