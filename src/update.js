// ==================================================
// CLIPBOARDFILTER - Update window
// Shows the new version, its release notes and the download progress.
// Runs sandboxed: everything goes through the whitelisted preload API.
// ==================================================

const bridge = window.api;
const $ = (id) => document.getElementById(id);

let translations = {};
let info = null;
let download = { phase: 'idle', received: 0, total: 0, bytesPerSecond: 0, supported: true };

function t(key, params = {}, fallback) {
  let result = key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), translations);
  if (typeof result !== 'string') result = fallback ?? key;
  for (const [k, v] of Object.entries(params)) result = result.split(`{${k}}`).join(String(v));
  return result;
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb >= 100 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n, {}, el.textContent);
  });
  document.title = t('updates.windowTitle', {}, 'ClipboardFilter update');
}

/** Removes HTML comments, including nested or unterminated ones. */
function stripComments(text) {
  let previous;
  do {
    previous = text;
    text = text.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  } while (text !== previous);
  return text;
}

/**
 * GitHub release notes are Markdown: show them as readable plain text.
 * The result is only ever displayed with textContent, never as HTML.
 */
function plainNotes(markdown) {
  return stripComments(String(markdown || ''))
    .replace(/\r\n/g, '\n')
    // GitHub's generated notes: keep the change titles, drop authors and links
    .replace(/ by @[\w-]+ in https:\/\/\S+/g, '')
    .replace(/^\*\*Full Changelog\*\*:.*$/gm, '')
    .replace(/^Full Changelog:.*$/gm, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function show(id, visible) {
  $(id).hidden = !visible;
}

function render() {
  if (!info) return;
  const available = info.status === 'available';
  $('update-title').textContent = available
    ? t('updates.windowHeading', { version: info.latest }, `ClipboardFilter ${info.latest} is available`)
    : t('updates.upToDate', { version: info.current }, `You have the latest version (${info.current})`);
  $('update-versions').textContent = available
    ? t('updates.versions', { current: info.current, latest: info.latest }, `Installed: ${info.current} → New: ${info.latest}`)
    : '';

  const notes = plainNotes(info.notes);
  $('update-notes').textContent = notes;
  show('notes-block', available && !!notes);

  const phase = download.phase;
  const busy = phase === 'downloading' || phase === 'verifying' || phase === 'installing';
  const supported = download.supported !== false;

  show('progress-block', busy || phase === 'ready');
  const bar = $('progress-bar');
  const percent = download.total ? Math.min(100, Math.round((download.received / download.total) * 100)) : 0;
  bar.classList.toggle('indeterminate', phase === 'verifying' || phase === 'installing' || (phase === 'downloading' && !download.total));
  bar.setAttribute('aria-valuenow', String(percent));
  $('progress-fill').style.width = phase === 'ready' ? '100%' : `${percent}%`;

  let label = '';
  let detail = '';
  if (phase === 'downloading') {
    label = t('updates.downloading', { percent }, `Downloading… ${percent}%`);
    detail = `${formatBytes(download.received)} / ${formatBytes(download.total)}`;
    if (download.bytesPerSecond) detail += ` · ${formatBytes(download.bytesPerSecond)}/s`;
  } else if (phase === 'verifying') {
    label = t('updates.verifying', {}, 'Verifying the file…');
  } else if (phase === 'ready') {
    label = t('updates.ready', {}, 'Download complete and verified');
    detail = formatBytes(download.total);
  } else if (phase === 'installing') {
    label = t('updates.installing', {}, 'Installing…');
  }
  $('progress-label').textContent = label;
  $('progress-detail').textContent = detail;

  const message = $('update-message');
  message.className = 'update-message';
  if (phase === 'error') {
    message.textContent = t(`updates.errors.${download.error || 'downloadFailed'}`, {}, t('updates.errors.downloadFailed', {}, 'The update failed.'));
    message.classList.add('error');
    message.hidden = false;
  } else if (available && !supported) {
    message.textContent = t('updates.manualOnly', {}, 'This copy of ClipboardFilter cannot update itself. Download the new version from the release page.');
    message.hidden = false;
  } else if (phase === 'ready') {
    message.textContent = t('updates.readyHint', {}, 'ClipboardFilter will close, install the update and restart.');
    message.classList.add('success');
    message.hidden = false;
  } else {
    message.hidden = true;
  }

  show('skip-btn', available && !busy && phase !== 'ready');
  show('later-btn', !busy);
  $('later-btn').textContent = available ? t('updates.later', {}, 'Later') : t('updates.close', {}, 'Close');
  show('cancel-btn', phase === 'downloading');
  show('page-btn', available && (!supported || phase === 'error'));
  show('download-btn', available && supported && (phase === 'idle' || phase === 'error'));
  $('download-btn').textContent = phase === 'error'
    ? t('updates.retry', {}, 'Try again')
    : t('updates.downloadInstall', {}, 'Download and install');
  show('install-btn', phase === 'ready' || phase === 'installing');
  $('install-btn').disabled = phase === 'installing';
}

async function call(channel, ...args) {
  try {
    return await bridge.invoke(channel, ...args);
  } catch (error) {
    console.error(channel, error);
    return null;
  }
}

function bindEvents() {
  $('download-btn').addEventListener('click', async () => {
    const state = await call('updates:download');
    if (state) { download = state; render(); }
  });
  $('cancel-btn').addEventListener('click', () => call('updates:cancel'));
  $('install-btn').addEventListener('click', () => call('updates:install'));
  $('later-btn').addEventListener('click', () => call('updates:close-window'));
  $('skip-btn').addEventListener('click', () => call('updates:skip'));
  $('page-btn').addEventListener('click', () => call('updates:open'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && download.phase !== 'installing') call('updates:close-window');
  });

  bridge.onUpdateStatus((next) => {
    if (next && next.status !== 'checking') { info = next; render(); }
  });
  bridge.onUpdateDownload((next) => {
    if (next) { download = next; render(); }
  });
}

async function init() {
  const state = await call('app:get-state');
  if (state) {
    translations = state.translations || {};
    const theme = state.settings?.theme;
    const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('dark-theme', dark);
    document.documentElement.lang = state.settings?.language || 'en';
  }
  applyTranslations();
  bindEvents();
  info = await call('updates:status');
  download = (await call('updates:download-state')) || download;
  render();
}

init();
