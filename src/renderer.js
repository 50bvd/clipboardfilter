'use strict';

// The renderer is sandboxed: it only talks to the main process through the
// whitelisted API exposed by preload.js. No inline event handlers are used
// (strict CSP), every dynamic value is escaped before being inserted.
const bridge = window.api;

// ============ STATE ============
const state = {
  filters: [],
  folders: [],
  settings: {},
  translations: {},
  locales: [],
  platform: '',
  collapsed: new Set(),
  search: '',
  editingFilterId: null,
  recordingShortcut: false,
  updateInfo: null
};

const categoryEmojis = {
  Developer: '💻',
  Finance: '💰',
  Personal: '👤',
  Health: '🏥',
  HR: '👔',
  System: '⚙️',
  Communication: '💬'
};
const DEFAULT_CATEGORIES = Object.keys(categoryEmojis);
const FOLDER_EMOJIS = ['📁', '💼', '🎯', '📊', '🔧', '💡', '🎨', '🚀', '⭐', '🔥', '💻', '💰', '👤', '🏥', '👔', '⚙️', '💬', '📝', '🎮', '📱'];
const LOCALE_NAMES = { en: 'English', fr: 'Français', de: 'Deutsch', es: 'Español', it: 'Italiano' };

const $ = (id) => document.getElementById(id);

// ============ UTILITIES ============
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function lookup(key) {
  let value = state.translations;
  for (const k of key.split('.')) {
    if (value && typeof value === 'object' && k in value) value = value[k];
    else return undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

/** Translate `key`; supports {name} and positional {0} parameters. */
function t(key, params = {}, fallback) {
  let result = lookup(key) ?? fallback ?? key;
  result = result.replace(/\\n/g, '\n');
  for (const [k, v] of Object.entries(params)) {
    result = result.split(`{${k}}`).join(String(v));
  }
  return result;
}

function humanizeKey(key) {
  const last = String(key || '').split('.').pop() || '';
  return last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
}

function filterName(filter) {
  if (filter.description) return filter.description;
  if (filter.descriptionKey) return lookup(filter.descriptionKey) ?? humanizeKey(filter.descriptionKey);
  return 'Filter';
}

function categoryName(category) {
  return lookup(`categories.${category}`) ?? category;
}

function errorMessage(error) {
  const code = error && error.message ? error.message : 'unknown';
  return t(`errors.${code}`, {}, t('errors.unknown'));
}

/** Invokes the main process; shows the error and resolves to null on failure. */
async function call(channel, ...args) {
  try {
    return await bridge.invoke(channel, ...args);
  } catch (error) {
    await showAlert(errorMessage(error));
    return null;
  }
}

function applyData(data) {
  if (!data) return;
  if (Array.isArray(data.filters)) state.filters = data.filters;
  if (Array.isArray(data.folders)) state.folders = data.folders;
  renderFilters();
  updateCategorySelector();
}

// ============ DIALOGS ============
function openDialog(build) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    const box = document.createElement('div');
    box.className = 'dialog-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    overlay.appendChild(box);

    let done = false;
    const close = (value) => {
      if (done) return;
      done = true;
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(null); }
    };

    const focusTarget = build(box, close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    setTimeout(() => (focusTarget || box.querySelector('button'))?.focus(), 30);
  });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function dialogButtons(box, buttons) {
  const row = el('div', 'dialog-buttons');
  for (const b of buttons) row.appendChild(b);
  box.appendChild(row);
}

function showAlert(message) {
  return openDialog((box, close) => {
    box.appendChild(el('div', 'dialog-message', message));
    const ok = el('button', 'btn btn-primary', 'OK');
    ok.addEventListener('click', () => close(true));
    dialogButtons(box, [ok]);
    return ok;
  });
}

function showConfirm(message, { danger = true } = {}) {
  return openDialog((box, close) => {
    box.appendChild(el('div', 'dialog-message', message));
    const cancel = el('button', 'btn btn-secondary', t('filterForm.cancel', {}, 'Cancel'));
    const ok = el('button', danger ? 'btn btn-danger' : 'btn btn-primary', 'OK');
    cancel.addEventListener('click', () => close(false));
    ok.addEventListener('click', () => close(true));
    dialogButtons(box, [cancel, ok]);
    return cancel;
  }).then(v => v === true);
}

function showPrompt(message, defaultValue = '') {
  return openDialog((box, close) => {
    box.appendChild(el('div', 'dialog-message', message));
    const input = el('input', 'form-input');
    input.type = 'text';
    input.value = defaultValue;
    input.maxLength = 200;
    box.appendChild(input);
    const cancel = el('button', 'btn btn-secondary', t('filterForm.cancel', {}, 'Cancel'));
    const ok = el('button', 'btn btn-primary', 'OK');
    cancel.addEventListener('click', () => close(null));
    ok.addEventListener('click', () => close(input.value.trim()));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value.trim()); });
    dialogButtons(box, [cancel, ok]);
    setTimeout(() => input.select(), 40);
    return input;
  });
}

function folderDialog({ title, name = '', icon = '📁' }) {
  return openDialog((box, close) => {
    box.appendChild(el('div', 'dialog-title', title));
    let selected = icon;
    const picker = el('div', 'emoji-picker');
    for (const emoji of FOLDER_EMOJIS) {
      const b = el('button', 'emoji-btn' + (emoji === selected ? ' selected' : ''), emoji);
      b.type = 'button';
      b.addEventListener('click', () => {
        selected = emoji;
        picker.querySelectorAll('.emoji-btn').forEach(x => x.classList.toggle('selected', x === b));
      });
      picker.appendChild(b);
    }
    box.appendChild(picker);
    const input = el('input', 'form-input');
    input.type = 'text';
    input.value = name;
    input.maxLength = 80;
    input.placeholder = t('folders.createPrompt', {}, 'Category name');
    box.appendChild(input);
    const submit = () => {
      const value = input.value.trim();
      close(value ? { name: value, icon: selected } : null);
    };
    const cancel = el('button', 'btn btn-secondary', t('filterForm.cancel', {}, 'Cancel'));
    const ok = el('button', 'btn btn-primary', 'OK');
    cancel.addEventListener('click', () => close(null));
    ok.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    dialogButtons(box, [cancel, ok]);
    setTimeout(() => input.select(), 40);
    return input;
  });
}

function chooseFolderDialog() {
  return openDialog((box, close) => {
    box.appendChild(el('div', 'dialog-title', t('folders.copyTo', {}, 'Copy to a category')));
    const list = el('div', 'dialog-list');
    for (const folder of state.folders) {
      const b = el('button', 'dialog-list-item', `${folder.icon || '📁'} ${folder.name}`);
      b.addEventListener('click', () => close(folder.id));
      list.appendChild(b);
    }
    box.appendChild(list);
    const cancel = el('button', 'btn btn-secondary', t('filterForm.cancel', {}, 'Cancel'));
    cancel.addEventListener('click', () => close(null));
    dialogButtons(box, [cancel]);
    return list.querySelector('button');
  });
}

// ============ TRANSLATIONS ============
function applyTranslations() {
  document.documentElement.lang = state.settings.language || 'en';
  document.querySelectorAll('[data-i18n]').forEach(node => {
    const value = lookup(node.dataset.i18n);
    if (value !== undefined) node.textContent = value;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => {
    const value = lookup(node.dataset.i18nPlaceholder);
    if (value !== undefined) node.placeholder = value;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(node => {
    const value = lookup(node.dataset.i18nTitle);
    if (value !== undefined) node.title = value;
  });
  updateCategorySelector();
  if (state.updateInfo) renderUpdateStatus(state.updateInfo);
}

// ============ THEME ============
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function updateTheme() {
  const theme = state.settings.theme;
  document.body.classList.toggle('dark-theme', theme === 'dark' || (theme === 'auto' && darkQuery.matches));
}

// ============ RENDER FILTERS ============
function matchesSearch(filter) {
  if (!state.search) return true;
  const q = state.search;
  return filterName(filter).toLowerCase().includes(q)
    || String(filter.pattern).toLowerCase().includes(q)
    || categoryName(filter.category || '').toLowerCase().includes(q);
}

function renderFilterCard(filter, inFolder) {
  const name = filterName(filter);
  const folderButton = inFolder
    ? `<button class="btn-icon-only" data-action="remove-from-folder" data-id="${escapeHtml(filter.id)}" title="${escapeHtml(t('folders.removeFrom', {}, 'Remove from category'))}">↩</button>`
    : `<button class="btn-icon-only" data-action="copy-to-folder" data-id="${escapeHtml(filter.id)}" title="${escapeHtml(t('folders.copyTo', {}, 'Copy to a category'))}">📋</button>`;
  return `
    <div class="filter-card ${filter.enabled ? '' : 'disabled'}">
      <input type="checkbox" class="filter-checkbox" data-action="toggle-filter" data-id="${escapeHtml(filter.id)}" ${filter.enabled ? 'checked' : ''} aria-label="${escapeHtml(name)}">
      <div class="filter-info">
        <div class="filter-description">${escapeHtml(name)}</div>
        <div class="filter-pattern" title="${escapeHtml(filter.pattern)}">${escapeHtml(filter.pattern)}</div>
      </div>
      <div class="filter-actions">
        ${folderButton}
        <button class="btn-icon-only" data-action="edit-filter" data-id="${escapeHtml(filter.id)}" title="${escapeHtml(t('config.editFilter', {}, 'Edit'))}">✎</button>
        <button class="btn-icon-only danger" data-action="delete-filter" data-id="${escapeHtml(filter.id)}" title="${escapeHtml(t('config.deleteFilter', {}, 'Delete'))}">🗑</button>
      </div>
    </div>`;
}

function renderGroup({ key, type, id, icon, title, items, allItems, actions }) {
  const enabledCount = allItems.filter(f => f.enabled).length;
  const collapsed = state.collapsed.has(key) && !state.search;
  const allChecked = enabledCount === allItems.length && allItems.length > 0;
  return `
    <div class="filter-category ${collapsed ? 'collapsed' : ''}">
      <div class="category-header" data-action="toggle-collapse" data-key="${escapeHtml(key)}">
        <div class="category-title">
          <span class="category-arrow">▼</span>
          <span>${escapeHtml(icon)} ${escapeHtml(title)}</span>
          <span class="category-count">(${enabledCount}/${allItems.length})</span>
        </div>
        <div class="folder-actions">
          <input type="checkbox" class="category-checkbox" data-action="toggle-group" data-type="${type}" data-id="${escapeHtml(id)}" ${allChecked ? 'checked' : ''} title="${escapeHtml(t('config.toggleAll', {}, 'Enable/disable all'))}">
          ${actions}
        </div>
      </div>
      <div class="category-filters">
        ${items.map(f => renderFilterCard(f, type === 'folder')).join('')}
      </div>
    </div>`;
}

function renderFilters() {
  const list = $('filters-list');
  const empty = $('no-filters');
  const total = state.filters.length;
  const enabled = state.filters.filter(f => f.enabled).length;
  $('filters-summary').textContent = t('config.summary', { enabled, total }, `${enabled}/${total}`);

  if (total === 0) {
    list.hidden = true;
    empty.hidden = false;
    return;
  }
  list.hidden = false;
  empty.hidden = true;

  const parts = [];

  for (const folder of state.folders) {
    const all = state.filters.filter(f => f.folder === folder.id);
    const items = all.filter(matchesSearch);
    if (state.search && items.length === 0) continue;
    parts.push(renderGroup({
      key: `folder-${folder.id}`,
      type: 'folder',
      id: folder.id,
      icon: folder.icon || '📁',
      title: folder.name,
      items,
      allItems: all,
      actions: `
        <button class="btn-icon-only" data-action="edit-folder" data-id="${escapeHtml(folder.id)}" title="${escapeHtml(t('config.editFilter', {}, 'Edit'))}">✎</button>
        <button class="btn-icon-only danger" data-action="delete-folder" data-id="${escapeHtml(folder.id)}" title="${escapeHtml(t('config.deleteFilter', {}, 'Delete'))}">🗑</button>`
    }));
  }

  const categories = new Map();
  for (const filter of state.filters) {
    if (filter.folder) continue;
    const cat = filter.category || 'Custom';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat).push(filter);
  }

  for (const category of [...categories.keys()].sort((a, b) => categoryName(a).localeCompare(categoryName(b)))) {
    const all = categories.get(category);
    const items = all.filter(matchesSearch);
    if (state.search && items.length === 0) continue;
    const deletable = all.every(f => !f.descriptionKey);
    parts.push(renderGroup({
      key: `category-${category}`,
      type: 'category',
      id: category,
      icon: categoryEmojis[category] || '📁',
      title: categoryName(category),
      items,
      allItems: all,
      actions: deletable
        ? `<button class="btn-icon-only danger" data-action="delete-category" data-id="${escapeHtml(category)}" title="${escapeHtml(t('config.deleteFilter', {}, 'Delete'))}">🗑</button>`
        : ''
    }));
  }

  list.innerHTML = parts.length ? parts.join('') : `<p class="no-results">${escapeHtml(t('config.noResults', {}, 'No results'))}</p>`;
}

function saveCollapsed() {
  try { localStorage.setItem('collapsed', JSON.stringify([...state.collapsed])); } catch { /* ignore */ }
}

function loadCollapsed() {
  try {
    const value = JSON.parse(localStorage.getItem('collapsed') || '[]');
    if (Array.isArray(value)) state.collapsed = new Set(value.filter(v => typeof v === 'string'));
  } catch { /* ignore */ }
}

// ============ FILTER LIST ACTIONS (event delegation) ============
async function onFiltersListClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const { action, id } = target.dataset;

  if (action === 'toggle-collapse') {
    if (event.target.closest('.folder-actions')) return;
    const key = target.dataset.key;
    if (state.collapsed.has(key)) state.collapsed.delete(key);
    else state.collapsed.add(key);
    saveCollapsed();
    renderFilters();
    return;
  }
  if (target.tagName === 'INPUT') return; // handled by change

  event.stopPropagation();
  switch (action) {
    case 'edit-filter': return editFilter(id);
    case 'delete-filter': return deleteFilter(id);
    case 'copy-to-folder': return copyToFolder(id);
    case 'remove-from-folder': return applyData(await call('filters:move-to-folder', id, null));
    case 'edit-folder': return editFolder(id);
    case 'delete-folder': return deleteFolder(id);
    case 'delete-category': return deleteCategory(id);
  }
}

async function onFiltersListChange(event) {
  const target = event.target;
  if (!target.dataset || !target.dataset.action) return;
  const { action, id, type } = target.dataset;

  if (action === 'toggle-filter') {
    applyData(await call('filters:set-enabled', [id], target.checked));
  } else if (action === 'toggle-group') {
    const group = type === 'folder'
      ? state.filters.filter(f => f.folder === id)
      : state.filters.filter(f => !f.folder && (f.category || 'Custom') === id);
    if (group.length === 0) return;
    const newState = !group.every(f => f.enabled);
    applyData(await call('filters:set-enabled', group.map(f => f.id), newState));
  }
}

async function editFilter(id) {
  const filter = state.filters.find(f => f.id === id);
  if (!filter) return;
  state.editingFilterId = id;
  $('filter-description').value = filterName(filter);
  updateCategorySelector();
  if (filter.folder) $('filter-category').value = filter.folder;
  else if (DEFAULT_CATEGORIES.includes(filter.category)) $('filter-category').value = `default:${filter.category}`;
  else $('filter-category').value = '';
  $('filter-pattern').value = filter.pattern;
  $('filter-replacement').value = filter.replacement;
  $('filter-regex').checked = !!filter.useRegex;
  $('filter-case').checked = !!filter.caseSensitive;
  $('filter-enabled').checked = !!filter.enabled;
  validatePatternField();
  openModal('filter-modal');
}

async function deleteFilter(id) {
  if (!(await showConfirm(t('config.deleteConfirm', {}, 'Delete?')))) return;
  applyData(await call('filters:delete', [id]));
}

async function copyToFolder(id) {
  if (state.folders.length === 0) {
    if (await showConfirm(t('folders.noFolderPrompt'), { danger: false })) await addCustomFolder();
    return;
  }
  const folderId = await chooseFolderDialog();
  if (folderId) applyData(await call('filters:copy-to-folder', id, folderId));
}

async function addCustomFolder() {
  const result = await folderDialog({ title: t('folders.createFolder', {}, 'New Category') });
  if (result) applyData(await call('folders:add', result));
}

async function editFolder(id) {
  const folder = state.folders.find(f => f.id === id);
  if (!folder) return;
  const result = await folderDialog({ title: t('config.editFilter', {}, 'Edit'), name: folder.name, icon: folder.icon || '📁' });
  if (result) applyData(await call('folders:update', id, result));
}

async function deleteFolder(id) {
  const count = state.filters.filter(f => f.folder === id).length;
  const message = count > 0
    ? t('folders.deleteWithFilters', { count }, `This category contains ${count} filter(s) that will also be deleted. Continue?`)
    : t('folders.deleteFolder', {}, 'Delete?');
  if (!(await showConfirm(message))) return;
  applyData(await call('folders:delete', id));
}

async function deleteCategory(category) {
  const items = state.filters.filter(f => !f.folder && (f.category || 'Custom') === category);
  if (items.some(f => f.descriptionKey)) {
    await showAlert(t('errors.cannotDeleteDefault'));
    return;
  }
  const message = t('folders.deleteCategoryConfirm', { name: categoryName(category), count: items.length },
    `Delete the category "${category}" and its ${items.length} filters?`);
  if (!(await showConfirm(message))) return;
  applyData(await call('filters:delete', items.map(f => f.id)));
}

// ============ FILTER FORM ============
function updateCategorySelector() {
  const select = $('filter-category');
  if (!select) return;
  const current = select.value;
  select.textContent = '';

  const none = document.createElement('option');
  none.value = '';
  none.textContent = t('filterForm.noCategoryOption', {}, 'Custom');
  select.appendChild(none);

  for (const name of DEFAULT_CATEGORIES) {
    const option = document.createElement('option');
    option.value = `default:${name}`;
    option.textContent = `${categoryEmojis[name]} ${categoryName(name)}`;
    select.appendChild(option);
  }

  if (state.folders.length > 0) {
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '──────────';
    select.appendChild(separator);
  }
  for (const folder of state.folders) {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = `${folder.icon || '📁'} ${folder.name}`;
    select.appendChild(option);
  }

  select.value = [...select.options].some(o => o.value === current) ? current : '';
}

function validatePatternField() {
  const pattern = $('filter-pattern').value;
  const useRegex = $('filter-regex').checked;
  const errorNode = $('filter-pattern-error');
  let error = null;
  if (useRegex && pattern) {
    try {
      const re = new RegExp(pattern, $('filter-case').checked ? 'g' : 'gi');
      const m = re.exec('');
      if (m && m[0] === '') error = t('errors.emptyMatch');
    } catch (e) {
      error = `${t('errors.invalidRegex')}: ${String(e.message).replace(/^Invalid regular expression: /, '')}`;
    }
  }
  errorNode.hidden = !error;
  errorNode.textContent = error || '';
  return !error;
}

function clearFilterForm() {
  $('filter-description').value = '';
  $('filter-category').value = '';
  $('filter-pattern').value = '';
  $('filter-replacement').value = '';
  $('filter-regex').checked = false;
  $('filter-case').checked = false;
  $('filter-enabled').checked = true;
  $('filter-pattern-error').hidden = true;
}

async function saveFilter() {
  const description = $('filter-description').value.trim();
  const target = $('filter-category').value;
  const pattern = $('filter-pattern').value;
  const replacement = $('filter-replacement').value;
  const useRegex = $('filter-regex').checked;
  const caseSensitive = $('filter-case').checked;
  const enabled = $('filter-enabled').checked;

  if (!description) return showAlert(t('errors.descriptionRequired'));
  if (!pattern.trim()) return showAlert(t('filterForm.patternRequired'));
  if (!validatePatternField()) return;

  const data = { description, pattern, replacement, useRegex, caseSensitive, enabled };
  if (target.startsWith('default:')) {
    data.category = target.slice('default:'.length);
    data.folder = null;
  } else if (target) {
    data.folder = target;
  } else {
    data.folder = null;
  }

  const existing = state.editingFilterId && state.filters.find(f => f.id === state.editingFilterId);
  if (existing) {
    // "No category" keeps a custom/imported category name as is
    if (!target) data.category = DEFAULT_CATEGORIES.includes(existing.category) && !existing.folder ? 'Custom' : existing.category;
    // A translated default description that was not changed stays translated
    if (existing.descriptionKey && description === filterName(existing) && !existing.description) delete data.description;
    const result = await call('filters:update', existing.id, data);
    if (!result) return;
    applyData(result);
  } else {
    if (!data.category) data.category = 'Custom';
    const result = await call('filters:add', data);
    if (!result) return;
    applyData(result);
  }
  closeModal('filter-modal');
}

// ============ MODALS ============
function openModal(id) {
  $(id).classList.add('active');
  const first = $(id).querySelector('input, select, textarea, button');
  if (first) setTimeout(() => first.focus(), 30);
}

function closeModal(id) {
  $(id).classList.remove('active');
  if (id === 'filter-modal') {
    state.editingFilterId = null;
    clearFilterForm();
  }
  if (id === 'shortcut-modal') stopRecordingShortcut();
}

// ============ TEST ============
async function testFilters({ silent = false } = {}) {
  const input = $('test-input').value;
  const output = $('test-output');
  const status = $('test-status');
  const details = $('test-details');

  if (!input.trim()) {
    output.value = '';
    status.hidden = true;
    details.textContent = '';
    if (!silent) showAlert(t('test.noInput'));
    return;
  }

  let result;
  try {
    result = await bridge.invoke('filters:test', input);
  } catch (error) {
    status.textContent = errorMessage(error);
    status.className = 'test-status error';
    status.hidden = false;
    return;
  }
  output.value = result.filtered;
  status.textContent = result.count > 0 ? t('test.filtered', { count: result.count }) : t('test.noMatches');
  status.className = `test-status ${result.count > 0 ? 'success' : 'info'}`;
  status.hidden = false;

  details.innerHTML = (result.details || [])
    .map(d => {
      const filter = state.filters.find(f => f.id === d.id);
      return filter ? `<li><span>${escapeHtml(filterName(filter))}</span><span class="badge">${d.count}</span></li>` : '';
    })
    .join('');
}

const liveTest = debounce(() => {
  if ($('test-live').checked) testFilters({ silent: true });
}, 250);

// ============ SETTINGS ============
function renderSettings() {
  const s = state.settings;
  const languageSelect = $('language-select');
  languageSelect.textContent = '';
  for (const locale of state.locales) {
    const option = document.createElement('option');
    option.value = locale;
    option.textContent = LOCALE_NAMES[locale] || locale;
    languageSelect.appendChild(option);
  }
  languageSelect.value = s.language;
  $('theme-select').value = s.theme;
  $('notifications-check').checked = !!s.notifications;
  $('autostart-check').checked = !!s.autoStart;
  $('startminimized-check').checked = !!s.startMinimized;
  $('pastemode-select').value = s.pasteMode;
  $('autofilter-check').checked = !!s.autoFilter;
  const clearSelect = $('clearclipboard-select');
  if (![...clearSelect.options].some(o => Number(o.value) === s.clearClipboardSeconds)) {
    const option = document.createElement('option');
    option.value = String(s.clearClipboardSeconds);
    option.textContent = `${s.clearClipboardSeconds} s`;
    clearSelect.appendChild(option);
  }
  clearSelect.value = String(s.clearClipboardSeconds || 0);
  $('checkupdates-check').checked = s.checkUpdates !== false;
  $('updatechannel-select').value = s.updateChannel || 'auto';
  $('shortcut-display').textContent = formatShortcut(s.shortcutPaste || '');
}

async function updateSettings(partial) {
  let result;
  try {
    result = await bridge.invoke('settings:update', partial);
  } catch (error) {
    await showAlert(errorMessage(error));
    renderSettings();
    return;
  }
  const languageChanged = result.settings.language !== state.settings.language;
  state.settings = result.settings;
  if (languageChanged) {
    state.translations = result.translations;
    applyTranslations();
    renderFilters();
  }
  renderSettings();
  updateTheme();
  if (result.error) await showAlert(t(`errors.${result.error}`));
  refreshDiagnostics();
}

function readSettingsForm() {
  return {
    language: $('language-select').value,
    theme: $('theme-select').value,
    notifications: $('notifications-check').checked,
    autoStart: $('autostart-check').checked,
    startMinimized: $('startminimized-check').checked,
    pasteMode: $('pastemode-select').value,
    autoFilter: $('autofilter-check').checked,
    clearClipboardSeconds: Number($('clearclipboard-select').value),
    checkUpdates: $('checkupdates-check').checked,
    updateChannel: $('updatechannel-select').value
  };
}

function formatShortcut(shortcut) {
  const mac = state.platform === 'darwin';
  return shortcut
    .replace('CommandOrControl', mac ? 'Cmd' : 'Ctrl')
    .replace('Command', 'Cmd')
    .replace('Control', 'Ctrl')
    .replace('Super', mac ? 'Cmd' : 'Super');
}

// ============ DIAGNOSTICS ============
async function refreshDiagnostics() {
  let d;
  try { d = await bridge.invoke('app:diagnostics'); } catch { return; }

  const badge = $('shortcut-badge');
  badge.hidden = false;
  badge.textContent = d.shortcut.registered ? t('system.active', {}, 'active') : t('system.unavailable', {}, 'unavailable');
  badge.className = `badge ${d.shortcut.registered ? 'ok' : 'warn'}`;

  const sessionLabel = { windows: 'Windows', macos: 'macOS', x11: 'X11', wayland: 'Wayland', unknown: '?' }[d.session] || d.session;
  const backends = d.pasteBackends.filter(b => b.available).map(b => b.name + (b.reliable ? '' : ' (XWayland)'));
  const rows = [
    [t('system.session', {}, 'Session'), `${sessionLabel}${d.desktop ? ` — ${d.desktop}` : ''}${d.isAppImage ? ' (AppImage)' : ''}`],
    [t('system.shortcut', {}, 'Global shortcut'), `${formatShortcut(d.shortcut.accelerator)} — ${d.shortcut.registered ? '✔' : '✖'}${d.shortcut.method === 'gnome' ? ` (${t('system.viaGnome', {}, 'GNOME shortcut')})` : ''}`],
    [t('system.pasteBackend', {}, 'Paste simulation'), backends.length ? backends.join(', ') : `✖ ${t('system.none', {}, 'none')}`],
    [t('system.clipboardBackend', {}, 'Clipboard access'), d.clipboardBackend],
    [t('system.autoMode', {}, 'Automatic mode'), t(`system.watch.${d.watchMode}`, {}, d.watchMode)],
    [t('system.tray', {}, 'System tray'), d.trayAvailable ? '✔' : '✖'],
    ['Version', `${d.version} (Electron ${d.electron})`]
  ];
  $('diag-table').innerHTML = rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('');

  const hints = [];
  if (d.platform === 'linux') {
    if (d.shortcut.method === 'gnome') hints.push(t('system.hintGnomeShortcut'));
    if (d.session === 'wayland') {
      if (d.shortcut.method !== 'gnome') hints.push(t('system.hintWaylandShortcut'));
      if (!backends.some(b => !b.includes('XWayland'))) hints.push(t('system.hintWaylandPaste'));
      if (d.clipboardBackend !== 'wl-clipboard') hints.push(t('system.hintWlClipboard'));
      if (d.watchMode === 'limited') hints.push(t('system.hintWatchLimited'));
    } else if (!backends.length) {
      hints.push(t('system.hintX11Paste'));
    }
    if (!d.shortcut.registered) hints.push(t('system.hintShortcutFailed'));
    hints.push(t('system.hintTray'));
  } else if (d.platform === 'darwin' && !d.accessibility) {
    hints.push(t('system.hintMacAccessibility'));
  } else if (!d.shortcut.registered) {
    hints.push(t('system.hintShortcutFailed'));
  }
  const hintBox = $('diag-hint');
  hintBox.hidden = hints.length === 0;
  hintBox.innerHTML = hints.map(h => `<p>${escapeHtml(h)}</p>`).join('');

  $('diag-command-group').hidden = d.platform !== 'linux';
  $('diag-command').value = d.pasteCommand;
  $('diag-accessibility-btn').hidden = !(d.platform === 'darwin' && !d.accessibility);
}

// ============ UPDATES ============
function renderUpdateStatus(info) {
  if (!info) return;
  if (info.status !== 'checking' || !state.updateInfo) state.updateInfo = info;
  const status = $('update-status');
  const download = $('download-update-btn');
  const checkBtn = $('check-updates-btn');
  status.className = 'update-status';
  download.hidden = info.status !== 'available';
  checkBtn.disabled = info.status === 'checking';
  switch (info.status) {
    case 'checking':
      status.textContent = t('updates.checking', {}, 'Checking…');
      break;
    case 'available':
      status.textContent = t('updates.available', { version: info.latest }, `Version ${info.latest} is available`);
      status.classList.add('available');
      break;
    case 'up-to-date':
      status.textContent = t('updates.upToDate', { version: info.current }, `Up to date (${info.current})`);
      break;
    case 'error':
      status.textContent = t('updates.error', {}, 'Could not check for updates');
      status.classList.add('error');
      break;
    default:
      status.textContent = t('updates.current', { version: info.current }, `Version ${info.current}`);
  }
}

async function checkUpdatesNow() {
  renderUpdateStatus({ status: 'checking' });
  try {
    renderUpdateStatus(await bridge.invoke('updates:check'));
  } catch {
    renderUpdateStatus({ status: 'error' });
  }
}

// ============ SHORTCUT RECORDER ============
function openShortcutRecorder() {
  openModal('shortcut-modal');
  $('shortcut-modal-status').textContent = t('shortcut.waiting');
  $('shortcut-modal-status').className = 'shortcut-status waiting';
  state.recordingShortcut = true;
  bridge.invoke('shortcut:suspend', true).catch(() => undefined);
  document.addEventListener('keydown', captureShortcut, true);
}

function stopRecordingShortcut() {
  if (!state.recordingShortcut) return;
  state.recordingShortcut = false;
  document.removeEventListener('keydown', captureShortcut, true);
  bridge.invoke('shortcut:suspend', false).catch(() => undefined);
}

const CODE_MAP = {
  Space: 'Space', Enter: 'Return', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right'
};

function keyFromEvent(event) {
  const code = event.code || '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `num${code.slice(6)}`;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return CODE_MAP[code] || null;
}

function captureShortcut(event) {
  if (!state.recordingShortcut) return;
  event.preventDefault();
  event.stopPropagation();

  if (event.key === 'Escape') {
    closeModal('shortcut-modal');
    return;
  }

  const mac = state.platform === 'darwin';
  const keys = [];
  if (mac) {
    if (event.metaKey) keys.push('Command');
    if (event.ctrlKey) keys.push('Control');
  } else {
    if (event.ctrlKey) keys.push('CommandOrControl');
    if (event.metaKey) keys.push('Super');
  }
  if (event.altKey) keys.push('Alt');
  if (event.shiftKey) keys.push('Shift');

  const key = keyFromEvent(event);
  if (!key) return; // modifier only
  if (keys.length === 0 && !/^F\d+$/.test(key)) return;

  keys.push(key);
  const shortcut = keys.join('+');
  $('shortcut-modal-status').textContent = `✔ ${formatShortcut(shortcut)}`;
  $('shortcut-modal-status').className = 'shortcut-status success';
  document.removeEventListener('keydown', captureShortcut, true);
  setTimeout(async () => {
    closeModal('shortcut-modal');
    await updateSettings({ shortcutPaste: shortcut });
  }, 600);
}

// ============ TABS ============
function switchTab(tab) {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `content-${tab}`));
  if (tab === 'settings') refreshDiagnostics();
}

// ============ TEMPLATES ============
async function exportTemplate() {
  if (!state.filters.some(f => !f.descriptionKey)) {
    await showAlert(t('templates.noCustomFilters'));
    return;
  }
  const name = await showPrompt(t('templates.exportPromptName'), 'My Template');
  if (!name) return;
  const description = await showPrompt(t('templates.exportPromptDesc'), '');
  if (description === null) return;
  const author = await showPrompt(t('templates.exportPromptAuthor'), '');
  if (author === null) return;
  const result = await call('templates:export', { name, description, author });
  if (result && result.saved) await showAlert(t('templates.exportSuccess', { 0: name, 1: result.count }));
}

async function handleTemplateFile(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    await showAlert(t('errors.importError'));
    return;
  }
  let content;
  let template;
  try {
    content = await file.text();
    template = JSON.parse(content.replace(/^﻿/, ''));
  } catch {
    await showAlert(t('errors.importError'));
    return;
  }
  if (!template || !Array.isArray(template.filters)) {
    await showAlert(t('errors.importError'));
    return;
  }
  const name = typeof template.name === 'string' ? template.name.slice(0, 100) : file.name;
  if (!(await showConfirm(t('templates.importConfirm', { 0: name, 1: template.filters.length }), { danger: false }))) return;
  const result = await call('templates:import', content);
  if (!result) return;
  applyData(result);
  let message = t('templates.importSuccess', { 0: result.added });
  if (result.skipped) message += `\n${t('templates.importSkipped', { 0: result.skipped })}`;
  await showAlert(message);
}

// ============ DATA MANAGEMENT ============
async function resetAllDefaults() {
  if (!(await showConfirm(t('settings.resetAllConfirm'), { danger: false }))) return;
  const result = await call('data:reset-defaults');
  if (!result) return;
  applyData(result);
  await showAlert(`${result.count} ${t('settings.filtersReset')}.`);
}

async function deleteAllCustom() {
  const count = state.filters.filter(f => !f.descriptionKey || f.folder).length;
  if (count === 0 && state.folders.length === 0) {
    await showAlert(t('settings.noCustomFilters'));
    return;
  }
  if (!(await showConfirm(t('settings.deleteAllConfirm', { 0: count })))) return;
  const result = await call('data:delete-custom');
  if (!result) return;
  applyData(result);
  await showAlert(`${result.filters} ${t('settings.customFiltersDeleted')} ${t('settings.and')} ${result.folders} ${t('settings.foldersDeleted')}.`);
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
  document.querySelectorAll('.tab-button').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  $('add-filter-btn').addEventListener('click', () => {
    state.editingFilterId = null;
    clearFilterForm();
    openModal('filter-modal');
  });
  $('add-folder-btn').addEventListener('click', addCustomFolder);
  $('filter-search').addEventListener('input', debounce((e) => {
    state.search = e.target.value.trim().toLowerCase();
    renderFilters();
  }, 120));

  $('filters-list').addEventListener('click', onFiltersListClick);
  $('filters-list').addEventListener('change', onFiltersListChange);

  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
  for (const id of ['filter-modal', 'shortcut-modal']) {
    $(id).addEventListener('mousedown', (e) => { if (e.target.id === id) closeModal(id); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('.dialog-overlay')) return;
    if ($('filter-modal').classList.contains('active')) closeModal('filter-modal');
  });

  $('filter-save').addEventListener('click', saveFilter);
  $('filter-pattern').addEventListener('input', debounce(validatePatternField, 150));
  $('filter-regex').addEventListener('change', validatePatternField);
  $('filter-case').addEventListener('change', validatePatternField);

  $('apply-filters-btn').addEventListener('click', () => testFilters());
  $('test-input').addEventListener('input', liveTest);

  for (const id of ['language-select', 'theme-select', 'notifications-check', 'autostart-check',
    'startminimized-check', 'pastemode-select', 'autofilter-check', 'clearclipboard-select',
    'checkupdates-check', 'updatechannel-select']) {
    $(id).addEventListener('change', () => updateSettings(readSettingsForm()));
  }
  $('change-shortcut-btn').addEventListener('click', openShortcutRecorder);
  $('diag-command').addEventListener('focus', (e) => e.target.select());
  $('diag-accessibility-btn').addEventListener('click', async () => {
    await bridge.invoke('app:request-accessibility').catch(() => undefined);
    setTimeout(refreshDiagnostics, 1500);
  });

  $('check-updates-btn').addEventListener('click', checkUpdatesNow);
  $('download-update-btn').addEventListener('click', () => bridge.invoke('updates:open').catch(() => undefined));
  bridge.onUpdateStatus(renderUpdateStatus);

  $('reset-all-defaults-btn').addEventListener('click', resetAllDefaults);
  $('delete-all-custom-btn').addEventListener('click', deleteAllCustom);

  $('export-template-btn').addEventListener('click', exportTemplate);
  $('import-template-btn').addEventListener('click', () => $('import-file-input').click());
  $('import-file-input').addEventListener('change', handleTemplateFile);

  darkQuery.addEventListener('change', updateTheme);
  bridge.onSettingsChanged((settings) => {
    const languageChanged = settings.language !== state.settings.language;
    state.settings = settings;
    renderSettings();
    updateTheme();
    if (languageChanged) {
      bridge.invoke('app:get-translations').then((translations) => {
        state.translations = translations;
        applyTranslations();
        renderFilters();
      }).catch(() => undefined);
    }
  });
}

// ============ INIT ============
async function init() {
  loadCollapsed();
  const initial = await bridge.invoke('app:get-state');
  state.filters = initial.filters;
  state.folders = initial.folders;
  state.settings = initial.settings;
  state.translations = initial.translations;
  state.locales = initial.locales;
  state.platform = initial.platform;
  document.body.classList.add(`platform-${state.platform}`);

  updateTheme();
  applyTranslations();
  renderSettings();
  renderFilters();
  setupEventListeners();
  refreshDiagnostics();
  bridge.invoke('updates:status').then(renderUpdateStatus).catch(() => undefined);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
