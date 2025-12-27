const { ipcRenderer } = require('electron');

// ============ STATE ============
let filters = [];
let customFolders = [];
let settings = {};
let translations = {};
let editingFilterId = null;
let collapsedCategories = new Set();
let isRecordingShortcut = false;
let recordedKeys = [];

const categoryEmojis = {
  'Developer': '💻',
  'Finance': '💰',
  'Personal': '👤',
  'Health': '🏥',
  'HR': '👔',
  'System': '⚙️',
  'Communication': '💬'
};

// ============ INITIALIZATION ============
async function init() {
  console.log('[INIT] Starting...');
  await loadTranslations();
  await loadFilters();
  await loadCustomFolders();
  await loadSettings();
  setupEventListeners();
  updateUI();
  console.log('[INIT] Complete');
}

// ============ TRANSLATIONS ============
async function loadTranslations() {
  translations = await ipcRenderer.invoke('get-all-translations');
  applyTranslations();
}

function t(key, params = {}) {
  const keys = key.split('.');
  let value = translations;
  for (const k of keys) {
    value = value?.[k];
  }
  let result = value || key;
  Object.keys(params).forEach(param => {
    result = result.replace(`{${param}}`, params[param]);
  });
  return result;
}

async function applyTranslations() {
  document.getElementById('header-subtitle').textContent = t('config.title').replace('ClipboardFilter - ', '');
  document.getElementById('tab-filters').textContent = t('config.filtersTab');
  document.getElementById('tab-test').textContent = t('config.testTab');
  document.getElementById('tab-settings').textContent = t('config.settingsTab');
  document.getElementById('add-filter-text').textContent = t('config.addFilter');
  document.getElementById('add-folder-text').textContent = t('folders.createFolder');
  document.getElementById('no-filters-text').textContent = t('config.noFilters');
  document.getElementById('test-input-label').textContent = t('test.inputLabel');
  document.getElementById('test-output-label').textContent = t('test.outputLabel');
  document.getElementById('apply-filters-text').textContent = t('test.applyFilters');
  document.getElementById('test-input').placeholder = t('test.inputPlaceholder');
  document.getElementById('settings-general-title').textContent = t('settings.title');
  document.getElementById('settings-language-label').textContent = t('settings.language');
  document.getElementById('settings-theme-label').textContent = t('settings.theme');
  document.getElementById('settings-notifications-label').textContent = t('settings.notifications');
  document.getElementById('settings-autostart-label').textContent = t('settings.autoStart');
  document.getElementById('settings-shortcuts-title').textContent = t('settings.shortcutsTitle');
  document.getElementById('settings-paste-shortcut-label').textContent = t('settings.pasteShortcut');
  document.getElementById('theme-auto').textContent = t('settings.themeAuto');
  document.getElementById('theme-light').textContent = t('settings.themeLight');
  document.getElementById('theme-dark').textContent = t('settings.themeDark');
  document.getElementById('filter-modal-title').textContent = t('filterForm.title');
  document.getElementById('filter-description-label').textContent = t('filterForm.descriptionLabel');
  document.getElementById('filter-category-label').textContent = t('filterForm.categoryLabel');
  document.getElementById('filter-pattern-label').textContent = t('filterForm.patternLabel');
  document.getElementById('filter-replacement-label').textContent = t('filterForm.replacementLabel');
  document.getElementById('filter-regex-label').textContent = t('filterForm.useRegex');
  document.getElementById('filter-enabled-label').textContent = t('filterForm.enabled');
  document.getElementById('filter-save-text').textContent = t('filterForm.save');
  document.getElementById('filter-cancel-text').textContent = t('filterForm.cancel');
  document.getElementById('filter-description').placeholder = t('filterForm.descriptionPlaceholder');
  document.getElementById('filter-pattern').placeholder = t('filterForm.patternPlaceholder');
  document.getElementById('filter-replacement').placeholder = t('filterForm.replacementPlaceholder');
  
  const hintLabel = document.getElementById('shortcut-hint-label');
  const hintText = document.getElementById('shortcut-hint-text');
  if (hintLabel) hintLabel.textContent = t('settings.hintLabel') || 'Tip:';
  if (hintText) hintText.textContent = t('settings.hintText') || 'Click Change';
  
  
  // Templates tab
  const templatesTitle = document.getElementById('templates-title');
  const templatesSubtitle = document.getElementById('templates-subtitle');
  const templatesExportTitle = document.getElementById('templates-export-title');
  const templatesExportDesc = document.getElementById('templates-export-desc');
  const templatesExportBtn = document.getElementById('templates-export-btn');
  const templatesImportTitle = document.getElementById('templates-import-title');
  const templatesImportDesc = document.getElementById('templates-import-desc');
  const templatesImportBtn = document.getElementById('templates-import-btn');
  const templatesFormatTitle = document.getElementById('templates-format-title');
  const templatesFormatDesc = document.getElementById('templates-format-desc');
  
  if (templatesTitle) templatesTitle.textContent = t('templates.title');
  if (templatesSubtitle) templatesSubtitle.textContent = t('templates.subtitle');
  if (templatesExportTitle) templatesExportTitle.textContent = t('templates.exportTitle');
  if (templatesExportDesc) templatesExportDesc.textContent = t('templates.exportDesc');
  if (templatesExportBtn) templatesExportBtn.textContent = t('templates.exportBtn');
  if (templatesImportTitle) templatesImportTitle.textContent = t('templates.importTitle');
  if (templatesImportDesc) templatesImportDesc.textContent = t('templates.importDesc');
  if (templatesImportBtn) templatesImportBtn.textContent = t('templates.importBtn');
  if (templatesFormatTitle) templatesFormatTitle.textContent = t('templates.formatTitle');
  if (templatesFormatDesc) templatesFormatDesc.textContent = t('templates.formatDesc');
  
  // Data management section
  const dataTitle = document.getElementById('settings-data-title');
  const resetAllText = document.getElementById('reset-all-defaults-text');
  const deleteAllText = document.getElementById('delete-all-custom-text');
  const changeShortcutText = document.getElementById('change-shortcut-text');
  if (dataTitle) dataTitle.textContent = t('settings.dataManagement');
  if (resetAllText) resetAllText.textContent = '↻ ' + t('settings.resetAllDefaults');
  if (deleteAllText) deleteAllText.textContent = '🗑 ' + t('settings.deleteAllCustom');
  if (changeShortcutText) changeShortcutText.textContent = t('settings.changeShortcut');
  
  // Shortcut modal
  const shortcutModalTitle = document.getElementById('shortcut-modal-title');
  const shortcutModalExamples = document.getElementById('shortcut-modal-examples');
  const shortcutCancelText = document.getElementById('shortcut-cancel-text');
  if (shortcutModalTitle) shortcutModalTitle.textContent = t('shortcut.modalTitle');
  if (shortcutModalExamples) shortcutModalExamples.textContent = t('shortcut.examples');
  if (shortcutCancelText) shortcutCancelText.textContent = t('shortcut.cancel');
  
  await updateCategorySelector();
}

// ============ DATA LOADING ============
async function loadFilters() {
  filters = await ipcRenderer.invoke('get-filters');
  console.log(`[INIT] Loaded ${filters.length} filters`);
  console.log('[DEBUG] Sample filter:', filters[0]);
  renderFilters();
}

async function loadCustomFolders() {
  customFolders = await ipcRenderer.invoke('get-custom-folders');
  console.log(`[INIT] Loaded ${customFolders.length} custom folders`);
}

async function loadSettings() {
  settings = await ipcRenderer.invoke('get-settings');
  const locales = await ipcRenderer.invoke('get-locales');
  const languageSelect = document.getElementById('language-select');
  languageSelect.innerHTML = '';
  
  const localeNames = {'en': 'English', 'fr': 'Français', 'de': 'Deutsch', 'es': 'Español', 'it': 'Italiano'};
  locales.forEach(locale => {
    const option = document.createElement('option');
    option.value = locale;
    option.textContent = localeNames[locale] || locale;
    languageSelect.appendChild(option);
  });
  
  languageSelect.value = settings.language;
  document.getElementById('theme-select').value = settings.theme;
  document.getElementById('notifications-check').checked = settings.notifications;
  document.getElementById('autostart-check').checked = settings.autoStart;
  if (settings.shortcutPaste) document.getElementById('shortcut-display').textContent = formatShortcut(settings.shortcutPaste);
}

// ============ RENDER FILTERS WITH SUBCATEGORIES ============
function renderFilters() {
  const filtersList = document.getElementById('filters-list');
  const noFilters = document.getElementById('no-filters');
  
  if (filters.length === 0) {
    filtersList.style.display = 'none';
    noFilters.style.display = 'block';
    return;
  }
  
  filtersList.style.display = 'block';
  noFilters.style.display = 'none';
  
  let html = '';
  
  // Custom Folders
  customFolders.forEach(folder => {
    const folderFilters = filters.filter(f => f.folder === folder.id);
    const enabledCount = folderFilters.filter(f => f.enabled).length;
    const isCollapsed = collapsedCategories.has('folder-' + folder.id);
    
    html += `
      <div class="filter-category ${isCollapsed ? 'collapsed' : ''}" data-type="folder" data-id="${folder.id}">
        <div class="category-header" onclick="toggleCategory('folder-${folder.id}')">
          <div class="category-title">
            <span class="category-arrow">▼</span>
            <span>${folder.icon || '📁'} ${escapeHtml(folder.name)}</span>
            <span class="category-count">(${enabledCount}/${folderFilters.length})</span>
          </div>
          <div class="folder-actions">
            <input type="checkbox" class="category-checkbox" ${enabledCount === folderFilters.length && folderFilters.length > 0 ? "checked" : ""} onchange="toggleCategoryFilters('${folder.id}', true)" onclick="event.stopPropagation()" title="Tout cocher/decocher">
            <button class="btn-icon-only" onclick="event.stopPropagation(); editFolder('${folder.id}')" title="Edit">✎</button>
            <button class="btn-icon-only danger" onclick="event.stopPropagation(); deleteFolder('${folder.id}')" title="Delete">🗑</button>
          </div>
        </div>
        <div class="category-filters">
          ${folderFilters.map(filter => renderFilterCard(filter, true)).join('')}
        </div>
      </div>
    `;
  });
  
  // Categories (simple, sans sous-catégories)
  const categoriesMap = {};
  filters.filter(f => !f.folder).forEach(filter => {
    const cat = filter.category || 'Uncategorized';
    if (!categoriesMap[cat]) categoriesMap[cat] = [];
    categoriesMap[cat].push(filter);
  });
  
  // Render each category
  Object.keys(categoriesMap).sort().forEach(category => {
    const categoryFilters = categoriesMap[category];
    const enabledCount = categoryFilters.filter(f => f.enabled).length;
    const isCategoryCollapsed = collapsedCategories.has(category);
    
    const emoji = categoryEmojis[category] || '📁';
    const categoryKey = `categories.${category}`;
    const translatedCategory = t(categoryKey);
    const displayName = translatedCategory === categoryKey ? category : translatedCategory;
    
    html += `
      <div class="filter-category ${isCategoryCollapsed ? 'collapsed' : ''}" data-type="category">
        <div class="category-header" onclick="toggleCategory('${escapeHtml(category)}')">
          <div class="category-title">
            <span class="category-arrow">▼</span>
            <span>${emoji} ${escapeHtml(displayName)}</span>
            <span class="category-count">(${enabledCount}/${categoryFilters.length})</span>
          </div>
          <div class="category-actions">
            <input type="checkbox" class="category-checkbox" ${enabledCount === categoryFilters.length && categoryFilters.length > 0 ? "checked" : ""} onchange="toggleCategoryFilters('${escapeHtml(category)}')" onclick="event.stopPropagation()" title="Tout cocher/decocher">

            ${categoryFilters.some(f => !f.descriptionKey) ? `
            <button class="btn-icon-only danger" onclick="event.stopPropagation(); deleteCategory('${escapeHtml(category)}')" title="Supprimer categorie">🗑</button>
            ` : ''}
          </div>
        </div>
        <div class="category-filters">
          ${categoryFilters.map(filter => renderFilterCard(filter, false)).join('')}
        </div>
      </div>
    `;
  });
  
  filtersList.innerHTML = html;
}

function renderFilterCard(filter, inFolder) {
  let description = filter.descriptionKey ? t(filter.descriptionKey) : (filter.description || 'Filter');
  const folderButton = !inFolder 
    ? `<button class="btn-icon-only" onclick="showMoveToFolderMenu('${filter.id}')" title="Copier vers dossier">📋</button>`
    : `<button class="btn-icon-only" onclick="removeFromFolder('${filter.id}')" title="Retirer du dossier">↩</button>`;
  
  return `
    <div class="filter-card ${!filter.enabled ? 'disabled' : ''}" data-id="${filter.id}">
      <input type="checkbox" class="filter-checkbox" ${filter.enabled ? 'checked' : ''} onchange="toggleFilter('${filter.id}')">
      <div class="filter-info">
        <div class="filter-description">${escapeHtml(description)}</div>
        <div class="filter-pattern" title="${escapeHtml(filter.pattern)}">${escapeHtml(filter.pattern)}</div>
      </div>
      <div class="filter-actions">
        ${folderButton}
        <button class="btn-icon-only" onclick="editFilter('${filter.id}')" title="Edit">✎</button>
        <button class="btn-icon-only danger" onclick="deleteFilter('${filter.id}')" title="Delete">🗑</button>
      </div>
    </div>
  `;
}

function toggleCategory(category) {
  if (collapsedCategories.has(category)) collapsedCategories.delete(category);
  else collapsedCategories.add(category);
  renderFilters();
}

async function toggleCategoryFilters(category, isFolder = false) {
  // Get filters in this category
  const categoryFilters = isFolder 
    ? filters.filter(f => f.folder === category)
    : filters.filter(f => !f.folder && (f.category === category || 'Uncategorized' === category));
  
  if (categoryFilters.length === 0) return;
  
  // Check if all are enabled
  const allEnabled = categoryFilters.every(f => f.enabled);
  const newState = !allEnabled;
  
  // Toggle all
  for (const filter of categoryFilters) {
    await ipcRenderer.invoke('update-filter', filter.id, { enabled: newState });
  }
  
  await loadFilters();
}

// ============ FILTER ACTIONS ============
async function toggleFilter(id) {
  const filter = filters.find(f => f.id === id);
  if (filter) {
    await ipcRenderer.invoke('update-filter', id, { enabled: !filter.enabled });
    await loadFilters();
  }
}

function editFilter(id) {
  const filter = filters.find(f => f.id === id);
  if (filter) {
    editingFilterId = id;
    let description = filter.description || '';
    if (filter.descriptionKey && !description) description = t(filter.descriptionKey);
    document.getElementById('filter-description').value = description;
    if (filter.folder) document.getElementById('filter-category').value = filter.folder;
    document.getElementById('filter-pattern').value = filter.pattern;
    document.getElementById('filter-replacement').value = filter.replacement;
    document.getElementById('filter-regex').checked = filter.useRegex;
    document.getElementById('filter-enabled').checked = filter.enabled;
    openModal('filter-modal');
  }
}

async function deleteFilter(id) {
  const confirmed = await customConfirm(t('config.deleteConfirm') || 'Delete?');
  if (confirmed) {
    await ipcRenderer.invoke('delete-filter', id);
    await loadFilters();
  }
}

async function saveFilter() {
  const description = document.getElementById('filter-description').value;
  const folderId = document.getElementById('filter-category').value;
  const pattern = document.getElementById('filter-pattern').value;
  const replacement = document.getElementById('filter-replacement').value;
  const useRegex = document.getElementById('filter-regex').checked;
  const enabled = document.getElementById('filter-enabled').checked;
  
  if (!description.trim()) { showCustomAlert('Description required'); return; }
  if (!pattern.trim()) { showCustomAlert(t('filterForm.patternRequired') || 'Pattern required'); return; }
  if (useRegex) { 
    try { new RegExp(pattern); } 
    catch (error) { showCustomAlert('Invalid regex'); return; } 
  }
  
  const filterData = { 
    description, pattern, replacement, useRegex, enabled, 
    category: 'Custom', 
    folder: folderId || undefined 
  };
  
  if (editingFilterId) {
    await ipcRenderer.invoke('update-filter', editingFilterId, filterData);
  } else {
    await ipcRenderer.invoke('add-filter', filterData);
  }
  
  await loadFilters();
  closeModal('filter-modal');
}

// ============ FOLDER ACTIONS ============
async function showMoveToFolderMenu(filterId) {
  if (customFolders.length === 0) {
    // Pas de dossier - proposer d'en créer un
    const create = await customConfirm(t('folders.noFolderPrompt') || 'Vous n\'avez pas encore créé de dossier. Voulez-vous en créer un maintenant ?');
    if (create) {
      await addCustomFolder();
    }
    return;
  }
  
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#2d3748;padding:24px;border-radius:12px;width:450px;max-height:600px;overflow-y:auto;';
  
  const title = document.createElement('div');
  title.textContent = 'Copier vers un dossier';
  title.style.cssText = 'color:#fff;font-size:20px;margin-bottom:16px;font-weight:600;';
  
  const folderList = document.createElement('div');
  folderList.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:16px;';
  
  customFolders.forEach(folder => {
    const btn = document.createElement('button');
    btn.textContent = `${folder.icon || '📁'} ${folder.name}`;
    btn.style.cssText = 'padding:12px;background:#1a1a1a;color:#fff;border:2px solid #444;border-radius:6px;cursor:pointer;font-size:14px;text-align:left;';
    btn.onmouseover = () => btn.style.borderColor = '#007bff';
    btn.onmouseout = () => btn.style.borderColor = '#444';
    btn.onclick = async () => {
      document.body.removeChild(overlay);
      // CLONER le filtre vers le dossier (pas déplacer)
      const originalFilter = filters.find(f => f.id === filterId);
      if (originalFilter) {
        await ipcRenderer.invoke('add-filter', {
          description: originalFilter.description,
          descriptionKey: originalFilter.descriptionKey,
          pattern: originalFilter.pattern,
          replacement: originalFilter.replacement,
          useRegex: originalFilter.useRegex,
          enabled: originalFilter.enabled,
          category: originalFilter.category,
          folder: folder.id
        });
        await loadFilters();
      }
    };
    folderList.appendChild(btn);
  });
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'width:100%;background:#6c757d;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;';
  cancelBtn.onclick = () => document.body.removeChild(overlay);
  
  box.appendChild(title);
  box.appendChild(folderList);
  box.appendChild(cancelBtn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
}

async function removeFromFolder(filterId) {
  await ipcRenderer.invoke('move-filter-to-folder', filterId, undefined);
  await loadFilters();
}

async function addCustomFolder() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#2d3748;padding:24px;border-radius:12px;width:450px;';
  
  const title = document.createElement('div');
  title.textContent = t('folders.createFolder') || 'New Folder';
  title.style.cssText = 'color:#fff;font-size:20px;margin-bottom:16px;font-weight:600;';
  
  const emojiContainer = document.createElement('div');
  emojiContainer.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;';
  
  const emojis = ['📁', '💼', '🎯', '📊', '🔧', '💡', '🎨', '🚀', '⭐', '🔥', '💻', '💰', '👤', '🏥', '👔', '⚙️', '💬', '📝', '🎮', '📱'];
  let selectedEmoji = '📁';
  
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.style.cssText = 'width:40px;height:40px;border:2px solid #444;background:#1a1a1a;border-radius:6px;cursor:pointer;font-size:20px;';
    btn.onclick = () => {
      selectedEmoji = emoji;
      emojiContainer.querySelectorAll('button').forEach(b => b.style.border = '2px solid #444');
      btn.style.border = '2px solid #007bff';
    };
    if (emoji === '📁') btn.style.border = '2px solid #007bff';
    emojiContainer.appendChild(btn);
  });
  
  box.appendChild(emojiContainer);
  
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = t('folders.createPrompt') || 'Folder name';
  input.style.cssText = 'padding:12px;font-size:16px;border:2px solid #007bff;border-radius:6px;width:100%;background:#fff;color:#000;outline:none;margin-bottom:16px;box-sizing:border-box;';
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display:flex;gap:12px;';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = t('filterForm.cancel') || 'Cancel';
  cancelBtn.style.cssText = 'flex:1;background:#6c757d;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;font-size:14px;';
  
  const validateBtn = document.createElement('button');
  validateBtn.textContent = 'OK';
  validateBtn.style.cssText = 'flex:1;background:#007bff;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;';
  
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(validateBtn);
  box.appendChild(title);
  box.appendChild(input);
  box.appendChild(buttonContainer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 50);
  
  const submit = async () => {
    const value = input.value.trim();
    document.body.removeChild(overlay);
    if (!value) return;
    await ipcRenderer.invoke('add-custom-folder', { name: value, icon: selectedEmoji, expanded: true });
    await loadCustomFolders();
    await updateCategorySelector();
    await loadFilters();
  };
  
  const cancel = () => document.body.removeChild(overlay);
  validateBtn.onclick = submit;
  cancelBtn.onclick = cancel;
  input.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') submit(); 
    if (e.key === 'Escape') cancel(); 
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });
}

async function editFolder(folderId) {
  const folder = customFolders.find(f => f.id === folderId);
  if (!folder) return;
  
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#2d3748;padding:24px;border-radius:12px;width:450px;';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = folder.name;
  input.style.cssText = 'padding:12px;font-size:16px;border:2px solid #007bff;border-radius:6px;width:100%;background:#fff;color:#000;outline:none;margin-bottom:16px;box-sizing:border-box;';
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display:flex;gap:12px;';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'flex:1;background:#6c757d;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;';
  
  const okBtn = document.createElement('button');
  okBtn.textContent = 'OK';
  okBtn.style.cssText = 'flex:1;background:#007bff;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;font-weight:600;';
  
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(okBtn);
  box.appendChild(input);
  box.appendChild(buttonContainer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(() => { input.focus(); input.select(); }, 50);
  
  const submit = async () => {
    const value = input.value.trim();
    document.body.removeChild(overlay);
    if (!value) return;
    await ipcRenderer.invoke('update-custom-folder', folderId, { name: value, icon: folder.icon });
    await loadCustomFolders();
    await loadFilters();
  };
  
  const cancel = () => document.body.removeChild(overlay);
  okBtn.onclick = submit;
  cancelBtn.onclick = cancel;
  input.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') submit(); 
    if (e.key === 'Escape') cancel(); 
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });
}

async function deleteFolder(folderId) {
  // Vérifier s'il y a des filtres dans ce dossier
  const folderFilters = filters.filter(f => f.folder === folderId);
  
  let message = t('folders.deleteFolder') || 'Supprimer ce dossier ?';
  if (folderFilters.length > 0) {
    message = `Ce dossier contient ${folderFilters.length} filtre(s). Si vous continuez, tous ces filtres seront également supprimés. Voulez-vous vraiment continuer ?`;
  }
  
  const confirmed = await customConfirm(message);
  if (confirmed) {
    await ipcRenderer.invoke('delete-custom-folder', folderId);
    await loadCustomFolders();
    await updateCategorySelector();
    await loadFilters();
  }
}

async function deleteCategory(category) {
  const categoryFilters = filters.filter(f => !f.folder && f.category === category);
  
  // Don't allow deleting default categories
  if (categoryFilters.some(f => f.descriptionKey)) {
    showCustomAlert(t('errors.cannotDeleteDefault') || 'Impossible de supprimer une categorie par defaut.');
    return;
  }
  
  const confirmed = await customConfirm(`${t('folders.deleteConfirm') || 'Supprimer la categorie'} \"${category}\" ${t('folders.andFilters') || 'et tous ses'} ${categoryFilters.length} filtres ?`);
  if (!confirmed) return;
  
  // Delete all filters in this category
  for (const filter of categoryFilters) {
    await ipcRenderer.invoke('delete-filter', filter.id);
  }
  
  await loadFilters();
}

async function resetCategory(category) {
  const confirmed = await customConfirm(`${t('settings.resetCategoryConfirm') || 'Reinitialiser tous les filtres de la categorie'} \"${category}\" aux valeurs par defaut ?`);
  if (!confirmed) return;
  
  const categoryFilters = filters.filter(f => !f.folder && f.category === category && f.descriptionKey);
  for (const filter of categoryFilters) {
    await ipcRenderer.invoke('update-filter', filter.id, { enabled: true });
  }
  
  await loadFilters();
  showCustomAlert(`${t('settings.categoryReset') || 'Categorie'} "${category}" ${t('settings.reset') || 'reinitialisee'}.`);
}


// ============ SUBCATEGORY ACTIONS ============
async function addSubcategoryToCategory(category) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#2d3748;padding:24px;border-radius:12px;width:450px;';
  
  const title = document.createElement('div');
  title.textContent = `New Subcategory in ${category}`;
  title.style.cssText = 'color:#fff;font-size:20px;margin-bottom:16px;font-weight:600;';
  
  const emojiContainer = document.createElement('div');
  emojiContainer.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;';
  
  const emojis = ['📋', '🔑', '🔀', '☁️', '🔷', '🔶', '🎫', '🗄️', '🔐', '📦', '🌐', '🌲', '🖨️', '🛡️', '🔥', '💻', '📡', '👥', '🔒', '📶'];
  let selectedEmoji = '📋';
  
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.style.cssText = 'width:40px;height:40px;border:2px solid #444;background:#1a1a1a;border-radius:6px;cursor:pointer;font-size:20px;';
    btn.onclick = () => {
      selectedEmoji = emoji;
      emojiContainer.querySelectorAll('button').forEach(b => b.style.border = '2px solid #444');
      btn.style.border = '2px solid #007bff';
    };
    if (emoji === '📋') btn.style.border = '2px solid #007bff';
    emojiContainer.appendChild(btn);
  });
  
  box.appendChild(emojiContainer);
  
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Subcategory name';
  input.style.cssText = 'padding:12px;font-size:16px;border:2px solid #007bff;border-radius:6px;width:100%;background:#fff;color:#000;outline:none;margin-bottom:16px;box-sizing:border-box;';
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display:flex;gap:12px;';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'flex:1;background:#6c757d;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;font-size:14px;';
  
  const validateBtn = document.createElement('button');
  validateBtn.textContent = 'OK';
  validateBtn.style.cssText = 'flex:1;background:#007bff;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;';
  
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(validateBtn);
  box.appendChild(title);
  box.appendChild(input);
  box.appendChild(buttonContainer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 50);
  
  const submit = async () => {
    const value = input.value.trim();
    document.body.removeChild(overlay);
    if (!value) return;
    await ipcRenderer.invoke('add-subcategory', { category, name: value, icon: selectedEmoji, expanded: true });
    await loadSubcategories();
    await loadFilters();
  };
  
  const cancel = () => document.body.removeChild(overlay);
  validateBtn.onclick = submit;
  cancelBtn.onclick = cancel;
  input.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') submit(); 
    if (e.key === 'Escape') cancel(); 
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });
}

async function editSubcategory(subcatId, category) {
  const subcat = subcategories.find(s => s.id === subcatId);
  if (!subcat) return;
  
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#2d3748;padding:24px;border-radius:12px;width:450px;';
  
  const title = document.createElement('div');
  title.textContent = 'Edit Subcategory';
  title.style.cssText = 'color:#fff;font-size:20px;margin-bottom:16px;font-weight:600;';
  
  const emojiContainer = document.createElement('div');
  emojiContainer.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;';
  
  const emojis = ['📋', '🔑', '🔀', '☁️', '🔷', '🔶', '🎫', '🗄️', '🔐', '📦', '🌐', '🌲', '🖨️', '🛡️', '🔥', '💻', '📡', '👥', '🔒', '📶'];
  let selectedEmoji = subcat.icon || '📋';
  
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.style.cssText = 'width:40px;height:40px;border:2px solid #444;background:#1a1a1a;border-radius:6px;cursor:pointer;font-size:20px;';
    btn.onclick = () => {
      selectedEmoji = emoji;
      emojiContainer.querySelectorAll('button').forEach(b => b.style.border = '2px solid #444');
      btn.style.border = '2px solid #007bff';
    };
    if (emoji === selectedEmoji) btn.style.border = '2px solid #007bff';
    emojiContainer.appendChild(btn);
  });
  
  box.appendChild(emojiContainer);
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = subcat.name;
  input.style.cssText = 'padding:12px;font-size:16px;border:2px solid #007bff;border-radius:6px;width:100%;background:#fff;color:#000;outline:none;margin-bottom:16px;box-sizing:border-box;';
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display:flex;gap:12px;';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'flex:1;background:#6c757d;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;';
  
  const okBtn = document.createElement('button');
  okBtn.textContent = 'OK';
  okBtn.style.cssText = 'flex:1;background:#007bff;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;font-weight:600;';
  
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(okBtn);
  box.appendChild(title);
  box.appendChild(input);
  box.appendChild(buttonContainer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(() => { input.focus(); input.select(); }, 50);
  
  const submit = async () => {
    const value = input.value.trim();
    document.body.removeChild(overlay);
    if (!value) return;
    
    // Update filters that use this subcategory
    const oldName = subcat.name;
    await ipcRenderer.invoke('update-subcategory', subcatId, { name: value, icon: selectedEmoji });
    
    // Update all filters using old subcategory name
    const filtersToUpdate = filters.filter(f => f.category === subcat.category && f.subcategory === oldName);
    for (const filter of filtersToUpdate) {
      await ipcRenderer.invoke('update-filter', filter.id, { subcategory: value });
    }
    
    await loadSubcategories();
    await loadFilters();
  };
  
  const cancel = () => document.body.removeChild(overlay);
  okBtn.onclick = submit;
  cancelBtn.onclick = cancel;
  input.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') submit(); 
    if (e.key === 'Escape') cancel(); 
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });
}

async function deleteSubcategory(subcatId) {
  const confirmed = await customConfirm('Delete this subcategory? Filters will be moved to "General".');
  if (confirmed) {
    await ipcRenderer.invoke('delete-subcategory', subcatId);
    await loadSubcategories();
    await loadFilters();
  }
}

// ============ CATEGORY SELECTOR ============
async function updateCategorySelector() {
  const categorySelect = document.getElementById('filter-category');
  if (!categorySelect) return;
  
  const currentValue = categorySelect.value;
  categorySelect.innerHTML = '';
  
  const noneOption = document.createElement('option');
  noneOption.value = '';
  noneOption.textContent = t('filterForm.noCategoryOption') || 'No folder';
  categorySelect.appendChild(noneOption);
  
  const defaultCategories = [
    {name: 'Developer', emoji: '💻'},
    {name: 'Finance', emoji: '💰'},
    {name: 'Personal', emoji: '👤'},
    {name: 'Health', emoji: '🏥'},
    {name: 'HR', emoji: '👔'},
    {name: 'System', emoji: '⚙️'},
    {name: 'Communication', emoji: '💬'}
  ];
  
  defaultCategories.forEach(cat => {
    const option = document.createElement('option');
    option.value = `default:${cat.name}`;
    const translated = t(`categories.${cat.name}`);
    option.textContent = `${cat.emoji} ` + (translated === `categories.${cat.name}` ? cat.name : translated);
    categorySelect.appendChild(option);
  });
  
  if (customFolders.length > 0) {
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '—————';
    categorySelect.appendChild(separator);
  }
  
  customFolders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = `${folder.icon || '📁'} ${folder.name}`;
    categorySelect.appendChild(option);
  });
  
  if (currentValue && (currentValue === '' || customFolders.find(f => f.id === currentValue))) {
    categorySelect.value = currentValue;
  } else {
    categorySelect.value = '';
  }
}

// ============ MODAL ============
function openModal(modalId) { 
  document.getElementById(modalId).classList.add('active'); 
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  if (modalId === 'filter-modal') { 
    editingFilterId = null; 
    clearFilterForm(); 
  }
  if (modalId === 'shortcut-modal') stopRecordingShortcut();
}

function clearFilterForm() {
  document.getElementById('filter-description').value = '';
  const categorySelect = document.getElementById('filter-category');
  if (categorySelect.options.length > 0) categorySelect.selectedIndex = 0;
  document.getElementById('filter-pattern').value = '';
  document.getElementById('filter-replacement').value = '';
  document.getElementById('filter-regex').checked = false;
  document.getElementById('filter-enabled').checked = true;
}

// ============ TEST ============
async function testFilters() {
  const input = document.getElementById('test-input').value;
  const output = document.getElementById('test-output');
  const status = document.getElementById('test-status');
  
  if (!input.trim()) { 
    showCustomAlert('Enter text'); 
    return; 
  }
  
  const result = await ipcRenderer.invoke('filter-text', input);
  output.value = result.filtered;
  
  if (result.count > 0) { 
    status.textContent = result.count + ' filtered'; 
    status.className = 'test-status success'; 
  } else { 
    status.textContent = 'No matches'; 
    status.className = 'test-status info'; 
  }
  status.style.display = 'block';
}

// ============ SETTINGS ============
async function updateSettings() {
  const language = document.getElementById('language-select').value;
  const theme = document.getElementById('theme-select').value;
  const notifications = document.getElementById('notifications-check').checked;
  const autoStart = document.getElementById('autostart-check').checked;
  
  await ipcRenderer.invoke('update-settings', { 
    language, theme, notifications, autoStart, 
    shortcutPaste: settings.shortcutPaste 
  });
  
  settings = { ...settings, language, theme, notifications, autoStart };
  await loadTranslations();
  await loadCustomFolders();
  await loadFilters();
  updateUI();
}

function formatShortcut(shortcut) {
  return shortcut
    .replace('CommandOrControl', 'Ctrl')
    .replace('Command', 'Cmd')
    .replace('Control', 'Ctrl');
}

// ============ SHORTCUTS ============
function openShortcutRecorder() { 
  openModal('shortcut-modal'); 
  document.getElementById('shortcut-modal-status').textContent = 'Press keys...'; 
  startRecordingShortcut(); 
}

function startRecordingShortcut() { 
  isRecordingShortcut = true; 
  recordedKeys = []; 
  document.addEventListener('keydown', captureShortcut); 
}

function stopRecordingShortcut() { 
  isRecordingShortcut = false; 
  document.removeEventListener('keydown', captureShortcut); 
}

function captureShortcut(event) {
  if (!isRecordingShortcut) return;
  
  event.preventDefault(); 
  event.stopPropagation();
  
  if (event.key === 'Escape') { 
    closeModal('shortcut-modal'); 
    return; 
  }
  
  recordedKeys = [];
  if (event.ctrlKey || event.metaKey) recordedKeys.push('CommandOrControl');
  if (event.altKey) recordedKeys.push('Alt');
  if (event.shiftKey) recordedKeys.push('Shift');
  
  const key = event.key;
  if (['Control','Shift','Alt','Meta'].includes(key)) return;
  if (recordedKeys.length === 0) return;
  
  let mainKey = key.toUpperCase();
  const keyMap = {
    'ARROWUP':'Up','ARROWDOWN':'Down','ARROWLEFT':'Left','ARROWRIGHT':'Right',
    'ENTER':'Return',' ':'Space','DELETE':'Delete','BACKSPACE':'Backspace'
  };
  if (keyMap[mainKey]) mainKey = keyMap[mainKey];
  
  recordedKeys.push(mainKey);
  const shortcut = recordedKeys.join('+');
  document.getElementById('shortcut-modal-status').textContent = 'Saved: ' + formatShortcut(shortcut);
  setTimeout(() => saveShortcut(shortcut), 1000);
}

async function saveShortcut(shortcut) {
  await ipcRenderer.invoke('update-settings', {...settings, shortcutPaste: shortcut});
  settings.shortcutPaste = shortcut;
  document.getElementById('shortcut-display').textContent = formatShortcut(shortcut);
  closeModal('shortcut-modal');
}

// ============ TABS ============
function switchTab(tabName) {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.getElementById(`content-${tabName}`).classList.add('active');
}


// ============ TEMPLATES EXPORT/IMPORT ============
async function exportTemplate() {
  console.log('[TEMPLATE] Export started');
  
  // CHECK IMMEDIATELY if there are custom filters
  const userFilters = filters.filter(f => !f.descriptionKey);
  
  if (userFilters.length === 0) {
    showCustomAlert(t('templates.noCustomFilters') || 'Aucun filtre personnalise a exporter.\\n\\nLes filtres par defaut ne peuvent pas etre exportes.\\nCreez vos propres filtres ou categories pour pouvoir exporter un template.');
    return;
  }
  
  const templateName = await customPrompt(t('templates.exportPromptName') || 'Nom du template:', 'Mon Template');
  if (!templateName) return;
  const description = await customPrompt(t('templates.exportPromptDesc') || 'Description (optionnel):', '');
  const author = await customPrompt(t('templates.exportPromptAuthor') || 'Auteur (optionnel):', '');
  
  const template = {
    name: templateName,
    description: description || 'Custom template',
    author: author || 'Anonymous',
    version: '1.0.0',
    filters: userFilters.map(f => ({
      category: f.category,
      description: f.description,
      pattern: f.pattern,
      replacement: f.replacement,
      useRegex: f.useRegex,
      enabled: f.enabled
    }))
  };
  const jsonStr = JSON.stringify(template, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${templateName.replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showCustomAlert(`Template "${templateName}" exporte! (${template.filters.length} filtres)`);
}

async function importTemplate() {
  document.getElementById('import-file-input').click();
}

async function handleTemplateFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const content = await file.text();
    const template = JSON.parse(content);
    if (!template.filters || !Array.isArray(template.filters)) {
      showCustomAlert('Erreur: Format invalide');
      return;
    }
    const confirmed = await customConfirm(`Importer "${template.name}" (${template.filters.length} filtres)?`);
    if (!confirmed) return;
    let importedCount = 0;
    for (const filter of template.filters) {
      try {
        await ipcRenderer.invoke('add-filter', {
          description: filter.description,
          descriptionKey: filter.descriptionKey,
          category: filter.category || 'Custom',
          pattern: filter.pattern,
          replacement: filter.replacement,
          useRegex: filter.useRegex !== false,
          enabled: filter.enabled !== false
        });
        importedCount++;
      } catch (err) { console.error(err); }
    }
    await loadFilters();
    showCustomAlert(`Importe: ${importedCount} filtres`);
  } catch (err) {
    showCustomAlert('Erreur: ' + err.message);
  }
  event.target.value = '';
}

function customPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#2d3748;color:#fff;padding:24px;border-radius:12px;width:400px;';
    const text = document.createElement('div');
    text.textContent = message;
    text.style.cssText = 'margin-bottom:16px;font-size:16px;';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    input.style.cssText = 'width:100%;padding:12px;font-size:14px;border:2px solid #007bff;border-radius:6px;background:#fff;color:#000;margin-bottom:16px;box-sizing:border-box;';
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;gap:12px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Annuler';
    cancelBtn.style.cssText = 'flex:1;background:#6c757d;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;';
    cancelBtn.onclick = () => { document.body.removeChild(overlay); resolve(null); };
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = 'flex:1;background:#007bff;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;font-weight:600;';
    okBtn.onclick = () => { document.body.removeChild(overlay); resolve(input.value.trim()); };
    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(okBtn);
    box.appendChild(text);
    box.appendChild(input);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    setTimeout(() => { input.focus(); input.select(); }, 50);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { document.body.removeChild(overlay); resolve(input.value.trim()); }
      if (e.key === 'Escape') { document.body.removeChild(overlay); resolve(null); }
    });
  });
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
  document.querySelectorAll('.tab-button').forEach(btn => 
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );
  document.getElementById('add-filter-btn').addEventListener('click', () => { 
    editingFilterId = null; 
    clearFilterForm(); 
    openModal('filter-modal'); 
  });
  document.getElementById('add-folder-btn').addEventListener('click', addCustomFolder);
  document.getElementById('modal-close').addEventListener('click', () => closeModal('filter-modal'));
  document.getElementById('filter-cancel').addEventListener('click', () => closeModal('filter-modal'));
  document.getElementById('shortcut-modal-close').addEventListener('click', () => closeModal('shortcut-modal'));
  document.getElementById('shortcut-cancel').addEventListener('click', () => closeModal('shortcut-modal'));
  document.getElementById('filter-modal').addEventListener('click', (e) => { 
    if (e.target.id === 'filter-modal') closeModal('filter-modal'); 
  });
  document.getElementById('shortcut-modal').addEventListener('click', (e) => { 
    if (e.target.id === 'shortcut-modal') closeModal('shortcut-modal'); 
  });
  document.getElementById('filter-save').addEventListener('click', saveFilter);
  document.getElementById('apply-filters-btn').addEventListener('click', testFilters);
  document.getElementById('language-select').addEventListener('change', updateSettings);
  document.getElementById('theme-select').addEventListener('change', updateSettings);
  document.getElementById('notifications-check').addEventListener('change', updateSettings);
  document.getElementById('autostart-check').addEventListener('change', updateSettings);
  document.getElementById('change-shortcut-btn').addEventListener('click', openShortcutRecorder);
  
  const resetDefaultsBtn = document.getElementById('reset-all-defaults-btn');
  const deleteCustomBtn = document.getElementById('delete-all-custom-btn');
  if (resetDefaultsBtn) resetDefaultsBtn.addEventListener('click', resetAllDefaults);
  if (deleteCustomBtn) deleteCustomBtn.addEventListener('click', deleteAllCustom);
  
  
  // Template buttons
  const exportBtn = document.getElementById('export-template-btn');
  const importBtn = document.getElementById('import-template-btn');
  const fileInput = document.getElementById('import-file-input');
  if (exportBtn) exportBtn.addEventListener('click', exportTemplate);
  if (importBtn) importBtn.addEventListener('click', importTemplate);
  if (fileInput) fileInput.addEventListener('change', handleTemplateFile);
}

// ============ UI ============
function updateUI() {
  document.body.classList.remove('dark-theme');
  if (settings.theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else if (settings.theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark-theme');
  }
}

// ============ UTILITIES ============
function escapeHtml(text) { 
  const div = document.createElement('div'); 
  div.textContent = text; 
  return div.innerHTML; 
}

function showCustomAlert(message) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#2d3748;color:#fff;padding:24px;border-radius:12px;max-width:400px;';
  
  const text = document.createElement('div');
  text.textContent = message;
  text.style.cssText = 'margin-bottom:16px;font-size:16px;';
  
  const btn = document.createElement('button');
  btn.textContent = 'OK';
  btn.style.cssText = 'background:#007bff;color:#fff;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;width:100%;';
  btn.onclick = () => document.body.removeChild(overlay);
  
  box.appendChild(text); 
  box.appendChild(btn); 
  overlay.appendChild(box); 
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', (e) => { 
    if (e.target === overlay) document.body.removeChild(overlay); 
  });
}

function customConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
    
    const box = document.createElement('div');
    box.style.cssText = 'background:#2d3748;color:#fff;padding:24px;border-radius:12px;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.4);';
    
    const text = document.createElement('div');
    text.textContent = message;
    text.style.cssText = 'margin-bottom:20px;font-size:16px;line-height:1.5;';
    
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;gap:12px;';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = t('filterForm.cancel') || 'Cancel';
    cancelBtn.style.cssText = 'flex:1;background:#6c757d;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;font-size:14px;';
    cancelBtn.onclick = () => { 
      document.body.removeChild(overlay); 
      resolve(false); 
    };
    
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = 'flex:1;background:#dc3545;color:#fff;border:none;padding:12px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;';
    okBtn.onclick = () => { 
      document.body.removeChild(overlay); 
      resolve(true); 
    };
    
    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(okBtn);
    box.appendChild(text);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', (e) => { 
      if (e.target === overlay) { 
        document.body.removeChild(overlay); 
        resolve(false); 
      } 
    });
  });
}

// ============ GLOBAL EXPORTS ============
window.toggleCategory = toggleCategory;
window.toggleCategoryFilters = toggleCategoryFilters;
window.deleteCategory = deleteCategory;
window.resetCategory = resetCategory;
window.resetCategory = resetCategory;
window.toggleFilter = toggleFilter;
window.editFilter = editFilter;
window.deleteFilter = deleteFilter;
window.showMoveToFolderMenu = showMoveToFolderMenu;
window.removeFromFolder = removeFromFolder;
window.editFolder = editFolder;
window.deleteFolder = deleteFolder;
window.addCustomFolder = addCustomFolder;

// ============ INIT ============
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


// ============ TEMPLATE MANAGEMENT ============
async function exportTemplate() {
  console.log('[TEMPLATE] Export started');
  
  const userFilters = filters.filter(f => !f.descriptionKey);
  
  if (userFilters.length === 0) {
    const msg = (t('templates.noCustomFilters') || 'Aucun filtre personnalise a exporter.\n\nLes filtres par defaut ne peuvent pas etre exportes.\nCreez vos propres filtres ou categories pour pouvoir exporter un template.').replace(/\\n/g, '\n');
    showCustomAlert(msg);
    return;
  }
  
  const templateName = await customPrompt(t('templates.exportPromptName') || 'Nom du template:', 'Mon Template');
  if (!templateName) return;
  const description = await customPrompt(t('templates.exportPromptDesc') || 'Description (optionnel):', '');
  const author = await customPrompt(t('templates.exportPromptAuthor') || 'Auteur (optionnel):', '');
  
  const template = {
    name: templateName,
    description: description || 'Custom template',
    author: author || 'Anonymous',
    version: '1.0.0',
    filters: userFilters.map(f => ({
      category: f.category,
      description: f.description,
      pattern: f.pattern,
      replacement: f.replacement,
      useRegex: f.useRegex,
      enabled: f.enabled
    }))
  };
  
  const jsonStr = JSON.stringify(template, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${templateName.replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showCustomAlert(`Template "${templateName}" exporte! (${template.filters.length} filtres)`);
}

async function importTemplate() {
  document.getElementById('import-file-input').click();
}

async function handleTemplateFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const content = await file.text();
    const template = JSON.parse(content);
    
    if (!template.filters || !Array.isArray(template.filters)) {
      showCustomAlert('Erreur: Format invalide');
      return;
    }
    
    const confirmed = await customConfirm(`Importer "${template.name}" (${template.filters.length} filtres)?`);
    if (!confirmed) return;
    
    let importedCount = 0;
    for (const filter of template.filters) {
      try {
        await ipcRenderer.invoke('add-filter', {
          description: filter.description,
          descriptionKey: filter.descriptionKey,
          category: filter.category || 'Custom',
          pattern: filter.pattern,
          replacement: filter.replacement,
          useRegex: filter.useRegex !== false,
          enabled: filter.enabled !== false
        });
        importedCount++;
      } catch (err) {
        console.error('Error importing filter:', err);
      }
    }
    
    await loadFilters();
    showCustomAlert(`${importedCount} filtres importes avec succes!`);
    event.target.value = '';
  } catch (err) {
    console.error('[TEMPLATE] Import error:', err);
    showCustomAlert('Erreur lors de l\'importation du template');
  }
}

// ============ DATA MANAGEMENT ============
async function resetAllDefaults() {
  const msg = (t('settings.resetAllConfirm') || 'Reinitialiser TOUS les filtres par defaut ?\n\nCela activera tous les filtres desactives mais ne supprimera pas vos filtres personnalises.').replace(/\\n/g, '\n');
  const confirmed = await customConfirm(msg);
  if (!confirmed) return;
  
  const defaultFilters = filters.filter(f => f.descriptionKey);
  for (const filter of defaultFilters) {
    await ipcRenderer.invoke('update-filter', filter.id, { enabled: true });
  }
  
  await loadFilters();
  showCustomAlert(defaultFilters.length + ' ' + (t('settings.filtersReset') || 'filtres par defaut reinitialises') + '.');
}

async function deleteAllCustom() {
  const customFilters = filters.filter(f => !f.descriptionKey);
  
  if (customFilters.length === 0) {
    showCustomAlert(t('settings.noCustomFilters') || 'Aucun filtre personnalise a supprimer.');
    return;
  }
  
  const msg = (t('settings.deleteAllConfirm') || 'Supprimer TOUS les filtres et categories personnalises ?\n\n{0} filtres seront supprimes.\n\nCette action est irreversible !').replace('{0}', customFilters.length).replace(/\\n/g, '\n');
  const confirmed = await customConfirm(msg);
  if (!confirmed) return;
  
  for (const filter of customFilters) {
    await ipcRenderer.invoke('delete-filter', filter.id);
  }
  
  for (const folder of customFolders) {
    await ipcRenderer.invoke('delete-custom-folder', folder.id);
  }
  
  await loadFilters();
  await loadCustomFolders();
  showCustomAlert(customFilters.length + ' ' + (t('settings.customFiltersDeleted') || 'filtres personnalises') + ' ' + (t('settings.and') || 'et') + ' ' + customFolders.length + ' ' + (t('settings.foldersDeleted') || 'dossiers supprimes') + '.');
}
