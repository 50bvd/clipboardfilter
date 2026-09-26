// ==================================================
// CLIPBOARDFILTER - Preload
// Exposes a minimal, whitelisted API to the (sandboxed) renderer.
// The renderer has no access to Node.js or to ipcRenderer itself.
// ==================================================

import { contextBridge, ipcRenderer } from 'electron';

const CHANNELS = new Set([
  'app:get-state', 'app:get-translations', 'app:diagnostics', 'app:open-help', 'app:request-accessibility',
  'filters:add', 'filters:update', 'filters:set-enabled', 'filters:delete',
  'filters:copy-to-folder', 'filters:move-to-folder', 'filters:test',
  'folders:add', 'folders:update', 'folders:delete',
  'settings:update', 'shortcut:suspend',
  'data:reset-defaults', 'data:delete-custom',
  'templates:export', 'templates:import',
  'updates:status', 'updates:check', 'updates:open'
]);

async function invoke(channel: string, ...args: unknown[]): Promise<any> {
  if (!CHANNELS.has(channel)) throw new Error('forbidden');
  const result = await ipcRenderer.invoke(channel, ...args);
  if (result && typeof result === 'object' && typeof result.__error === 'string') {
    throw new Error(result.__error);
  }
  return result;
}

contextBridge.exposeInMainWorld('api', {
  invoke,
  onSettingsChanged: (callback: (settings: unknown) => void) => {
    ipcRenderer.on('settings-changed', (_event, settings) => callback(settings));
  },
  onUpdateStatus: (callback: (info: unknown) => void) => {
    ipcRenderer.on('update-status', (_event, info) => callback(info));
  }
});
