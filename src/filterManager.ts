// ==================================================
// CLIPBOARDFILTER - Filter Manager
// Filter/folder/settings management with in-memory caching and strict
// validation of everything coming from the renderer or imported templates.
// ==================================================

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { JsonStore } from './store';
import { LIMITS, validatePattern } from './filterEngine';

// Filter rule interface
export interface FilterRule {
  id: string;
  descriptionKey?: string;
  description?: string;
  pattern: string;
  replacement: string;
  useRegex: boolean;
  enabled: boolean;
  caseSensitive?: boolean;
  category: string;
  folder?: string;
}

// Custom folder interface
export interface CustomFolder {
  id: string;
  name: string;
  icon?: string;
  expanded?: boolean;
}

export type PasteMode = 'simulate' | 'clipboard';

// Application settings interface
export interface AppSettings {
  language: string;
  autoStart: boolean;
  notifications: boolean;
  theme: 'light' | 'dark' | 'auto';
  shortcutPaste: string;
  pasteMode: PasteMode;
  autoFilter: boolean;
  clearClipboardSeconds: number;
  startMinimized: boolean;
  checkUpdates: boolean;
  updateChannel: 'auto' | 'stable' | 'beta';
}

interface StoreSchema {
  schemaVersion: number;
  filters: FilterRule[];
  customFolders: CustomFolder[];
  settings: AppSettings;
}

export class ValidationError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'ValidationError';
  }
}

const SCHEMA_VERSION = 2;
const MAX_FILTERS = 5000;
const MAX_FOLDERS = 200;
const MAX_TEXT = 200;
const SHORTCUT_RE = /^[A-Za-z0-9]+(\+[A-Za-z0-9]+){0,4}$/;

// BIC: bank (4 letters) + ISO 3166 country code + location (+ branch)
const SWIFT_PATTERN = "\\b[A-Z]{4}(?:A[DEFGILMOQRSTUWXZ]|B[ABDEFGHIJLMNOQRSTVWYZ]|C[ACDFGHIKLMNORUVWXYZ]|D[EJKMOZ]|E[CEGHRST]|F[IJKMOR]|G[ABDEFGHILMNPQRSTUWY]|H[KMNRTU]|I[DELMNOQRST]|J[EMOP]|K[EGHIMNPRWYZ]|L[ABCIKRSTUVY]|M[ACDEFGHKLMNOPQRSTUVWXYZ]|N[ACEFGILOPRUZ]|OM|P[AEFGHKLMNRSTWY]|QA|R[EOSUW]|S[ABCDEGHIJKLMNORSTVXYZ]|T[CDFGHJKLMNORTVWZ]|U[AGMSYZ]|V[ACEGINU]|W[FS]|XK|Y[ET]|Z[AMW])[A-Z0-9]{2}(?:[A-Z0-9]{3})?\\b";

// Default patterns that shipped broken in 1.0.0 and are fixed on upgrade
// (only when the user did not modify them).
const PATTERN_MIGRATIONS: Record<string, { from: string[]; to: string; caseSensitive?: boolean }> = {
  // Never matched in 1.0.0; a plain [A-Z]{8} would now match any 8-letter word
  'filters.finance.swift': {
    from: ['\\\\b[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\\\\b'],
    to: SWIFT_PATTERN,
    caseSensitive: true
  },
  'filters.personal.passport': {
    from: ['(?:Passport|Passeport)[\\\\s#:-]+[A-Z]{1,2}[0-9]{6,9}'],
    to: '(?:Passport|Passeport)[\\s#:-]+[A-Z]{1,2}[0-9]{6,9}'
  },
  'filters.personal.drivingLicense': {
    from: ['(?:DL|License|Permis)[\\\\s#:-]+[A-Z0-9]{6,15}'],
    to: '(?:DL|License|Permis)[\\s#:-]+[A-Z0-9]{6,15}'
  },
  'filters.hr.salary': {
    from: ['(?:salary|Salary)[:\\s]+[0-9]{3,}(?:[.,][0-9]{2})?[\\s]?(?:â‚¬|\\$|Â£)'],
    to: '(?:salary|Salary)[:\\s]+[0-9]{3,}(?:[.,][0-9]{2})?[\\s]?(?:€|\\$|£)'
  },
  'filters.developer.azureSas': {
    from: ['(?:sv|sig|se|spr|sp|sr)=(?:[^&\\s]+&?)+'],
    to: '(?:sv|sig|se|spr|sp|sr)=[^&\\s]+(?:&[^&\\s]+)*&?'
  }
};

export function defaultSettings(): AppSettings {
  return {
    language: 'en',
    autoStart: false,
    notifications: true,
    theme: 'auto',
    shortcutPaste: 'CommandOrControl+Shift+V',
    pasteMode: 'simulate',
    autoFilter: false,
    clearClipboardSeconds: 0,
    // Many Linux desktops (e.g. GNOME) have no system tray by default,
    // so the window is shown at startup there.
    startMinimized: process.platform !== 'linux',
    checkUpdates: true,
    // "auto": follow pre-releases when running a pre-release, stable otherwise
    updateChannel: 'auto'
  };
}

function cleanText(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== 'string') return '';
  // Strip control characters (except tab/newline) and trim
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export class FilterManager {
  private store: JsonStore<StoreSchema>;
  private listeners: Array<() => void> = [];
  private availableLocales: string[];

  constructor(configPath: string, private defaultFiltersPath: string, availableLocales: string[]) {
    this.availableLocales = availableLocales;
    this.store = new JsonStore<StoreSchema>(configPath, {
      schemaVersion: SCHEMA_VERSION,
      filters: [],
      customFolders: [],
      settings: defaultSettings()
    });

    // Normalize settings (adds new keys for older configurations)
    this.store.set('settings', this.sanitizeSettings({ ...defaultSettings(), ...(this.store.get('settings') || {}) }));

    const filters = this.store.get('filters');
    if (!Array.isArray(filters) || filters.length === 0) {
      this.store.set('filters', this.getDefaultFilters());
    } else {
      this.migrate();
    }
    if (!Array.isArray(this.store.get('customFolders'))) this.store.set('customFolders', []);
    this.store.set('schemaVersion', SCHEMA_VERSION);
  }

  public onRulesChanged(listener: () => void): void {
    this.listeners.push(listener);
  }

  public flush(): void {
    this.store.flush();
  }

  private emitChange(): void {
    for (const l of this.listeners) {
      try { l(); } catch (e) { console.error('[FilterManager] listener error', e); }
    }
  }

  private migrate(): void {
    let changed = false;
    const filters = this.store.get('filters').map((f) => {
      const m = f.descriptionKey ? PATTERN_MIGRATIONS[f.descriptionKey] : undefined;
      if (m && m.from.includes(f.pattern)) {
        changed = true;
        return m.caseSensitive ? { ...f, pattern: m.to, caseSensitive: true } : { ...f, pattern: m.to };
      }
      return f;
    });
    if (changed) {
      this.store.set('filters', filters);
      console.log('[FilterManager] Migrated broken default patterns');
    }
  }

  // Load default filters from JSON file
  private readDefaultFilters(): Omit<FilterRule, 'id'>[] {
    try {
      const data = fs.readFileSync(this.defaultFiltersPath, 'utf-8');
      const parsed = JSON.parse(data.replace(/^﻿/, ''));
      return (parsed.filters || []).map((f: any) => ({
        descriptionKey: f.descriptionKey,
        pattern: f.pattern,
        replacement: f.replacement ?? '',
        useRegex: f.useRegex !== false,
        enabled: f.enabled !== false,
        caseSensitive: f.caseSensitive === true ? true : undefined,
        category: f.category || 'Custom'
      }));
    } catch (error) {
      console.error('[FilterManager] Error loading default filters:', error);
      return [];
    }
  }

  private getDefaultFilters(): FilterRule[] {
    return this.readDefaultFilters().map(f => ({ ...f, id: randomUUID() }));
  }

  // === VALIDATION ===

  private sanitizeFilter(input: any, base?: FilterRule): Omit<FilterRule, 'id'> {
    if (!input || typeof input !== 'object') throw new ValidationError('invalidInput');
    const merged: any = { ...(base || {}) };

    if ('description' in input) merged.description = cleanText(input.description) || undefined;
    if ('descriptionKey' in input) {
      merged.descriptionKey = typeof input.descriptionKey === 'string' && /^filters\.[A-Za-z0-9_.]+$/.test(input.descriptionKey)
        ? input.descriptionKey : undefined;
    }
    if ('pattern' in input) merged.pattern = typeof input.pattern === 'string' ? input.pattern : '';
    if ('replacement' in input) {
      merged.replacement = typeof input.replacement === 'string' ? input.replacement.slice(0, LIMITS.replacementLength) : '';
    }
    if ('useRegex' in input) merged.useRegex = !!input.useRegex;
    if ('enabled' in input) merged.enabled = !!input.enabled;
    if ('caseSensitive' in input) merged.caseSensitive = input.caseSensitive === true ? true : undefined;
    if ('category' in input) merged.category = cleanText(input.category, 60) || 'Custom';
    if ('folder' in input) {
      const folder = typeof input.folder === 'string' ? input.folder : undefined;
      merged.folder = folder && this.getCustomFolders().some(f => f.id === folder) ? folder : undefined;
    }

    merged.useRegex = !!merged.useRegex;
    merged.enabled = merged.enabled !== false;
    merged.replacement = typeof merged.replacement === 'string' ? merged.replacement : '';
    merged.category = merged.category || 'Custom';

    const error = validatePattern(merged.pattern, merged.useRegex, !!merged.caseSensitive);
    if (error) throw new ValidationError(error);
    if (!merged.description && !merged.descriptionKey) throw new ValidationError('descriptionRequired');

    delete merged.id;
    return {
      descriptionKey: merged.descriptionKey,
      description: merged.description,
      pattern: merged.pattern,
      replacement: merged.replacement,
      useRegex: merged.useRegex,
      enabled: merged.enabled,
      caseSensitive: merged.caseSensitive,
      category: merged.category,
      folder: merged.folder
    };
  }

  private sanitizeSettings(input: any, base: AppSettings = defaultSettings()): AppSettings {
    const s: AppSettings = { ...base };
    if (!input || typeof input !== 'object') return s;
    if (typeof input.language === 'string' && this.availableLocales.includes(input.language)) s.language = input.language;
    if (typeof input.autoStart === 'boolean') s.autoStart = input.autoStart;
    if (typeof input.notifications === 'boolean') s.notifications = input.notifications;
    if (['light', 'dark', 'auto'].includes(input.theme)) s.theme = input.theme;
    if (typeof input.shortcutPaste === 'string' && SHORTCUT_RE.test(input.shortcutPaste)) s.shortcutPaste = input.shortcutPaste;
    if (input.pasteMode === 'simulate' || input.pasteMode === 'clipboard') s.pasteMode = input.pasteMode;
    if (typeof input.autoFilter === 'boolean') s.autoFilter = input.autoFilter;
    if (Number.isFinite(input.clearClipboardSeconds)) {
      s.clearClipboardSeconds = Math.max(0, Math.min(3600, Math.round(input.clearClipboardSeconds)));
    }
    if (typeof input.startMinimized === 'boolean') s.startMinimized = input.startMinimized;
    if (typeof input.checkUpdates === 'boolean') s.checkUpdates = input.checkUpdates;
    if (['auto', 'stable', 'beta'].includes(input.updateChannel)) s.updateChannel = input.updateChannel;
    return s;
  }

  // === CUSTOM FOLDERS ===

  public getCustomFolders(): CustomFolder[] {
    return this.store.get('customFolders');
  }

  public addCustomFolder(input: any): CustomFolder {
    const name = cleanText(input?.name, 80);
    if (!name) throw new ValidationError('nameRequired');
    const folders = this.getCustomFolders();
    if (folders.length >= MAX_FOLDERS) throw new ValidationError('tooManyFolders');
    const folder: CustomFolder = {
      id: randomUUID(),
      name,
      icon: cleanText(input?.icon, 8) || '📁',
      expanded: true
    };
    this.store.set('customFolders', [...folders, folder]);
    return folder;
  }

  public updateCustomFolder(id: string, updates: any): void {
    const folders = this.getCustomFolders().map(f => {
      if (f.id !== id) return f;
      const next = { ...f };
      if (updates && 'name' in updates) next.name = cleanText(updates.name, 80) || f.name;
      if (updates && 'icon' in updates) next.icon = cleanText(updates.icon, 8) || f.icon;
      if (updates && 'expanded' in updates) next.expanded = !!updates.expanded;
      return next;
    });
    this.store.set('customFolders', folders);
  }

  // Deletes the folder AND all filters inside
  public deleteCustomFolder(id: string): void {
    this.store.set('filters', this.getFilters().filter(f => f.folder !== id));
    this.store.set('customFolders', this.getCustomFolders().filter(f => f.id !== id));
    this.emitChange();
  }

  // === FILTERS ===

  public getFilters(): FilterRule[] {
    return this.store.get('filters');
  }

  public getCategories(): string[] {
    const categories = new Set(this.getFilters().filter(f => !f.folder).map(f => f.category));
    return Array.from(categories).sort();
  }

  public addFilter(input: any): FilterRule {
    const filters = this.getFilters();
    if (filters.length >= MAX_FILTERS) throw new ValidationError('tooManyFilters');
    const filter: FilterRule = { ...this.sanitizeFilter(input), id: randomUUID() };
    this.store.set('filters', [...filters, filter]);
    this.emitChange();
    return filter;
  }

  /** Bulk import (templates). Invalid entries are skipped, not fatal. */
  public addFilters(inputs: any[]): { added: number; skipped: number } {
    if (!Array.isArray(inputs)) throw new ValidationError('invalidInput');
    const filters = [...this.getFilters()];
    let added = 0;
    let skipped = 0;
    for (const input of inputs) {
      if (filters.length >= MAX_FILTERS) { skipped++; continue; }
      try {
        filters.push({ ...this.sanitizeFilter(input), id: randomUUID() });
        added++;
      } catch {
        skipped++;
      }
    }
    this.store.set('filters', filters);
    this.emitChange();
    return { added, skipped };
  }

  public updateFilter(id: string, updates: any): FilterRule {
    const filters = [...this.getFilters()];
    const index = filters.findIndex(f => f.id === id);
    if (index === -1) throw new ValidationError('notFound');
    filters[index] = { ...this.sanitizeFilter(updates, filters[index]), id };
    this.store.set('filters', filters);
    this.emitChange();
    return filters[index];
  }

  public setFiltersEnabled(ids: string[], enabled: boolean): void {
    const set = new Set(Array.isArray(ids) ? ids : []);
    this.store.set('filters', this.getFilters().map(f => (set.has(f.id) ? { ...f, enabled: !!enabled } : f)));
    this.emitChange();
  }

  public deleteFilters(ids: string[]): void {
    const set = new Set(Array.isArray(ids) ? ids : []);
    this.store.set('filters', this.getFilters().filter(f => !set.has(f.id)));
    this.emitChange();
  }

  public moveFilterToFolder(filterId: string, folderId: string | undefined): void {
    this.updateFilter(filterId, { folder: folderId });
  }

  public copyFilterToFolder(filterId: string, folderId: string): FilterRule {
    const original = this.getFilters().find(f => f.id === filterId);
    if (!original) throw new ValidationError('notFound');
    if (!this.getCustomFolders().some(f => f.id === folderId)) throw new ValidationError('notFound');
    const { id, ...rest } = original;
    return this.addFilter({ ...rest, folder: folderId });
  }

  // === SETTINGS ===

  public getSettings(): AppSettings {
    return this.store.get('settings');
  }

  public updateSettings(settings: any): AppSettings {
    const next = this.sanitizeSettings(settings, this.getSettings());
    this.store.set('settings', next);
    return next;
  }

  // === DATA MANAGEMENT ===

  /** Re-enables every default filter and restores deleted ones. */
  public resetDefaults(): number {
    const defaults = this.readDefaultFilters();
    const filters = this.getFilters().map(f => (f.descriptionKey && !f.folder ? { ...f, enabled: true } : f));
    const present = new Set(filters.filter(f => !f.folder).map(f => f.descriptionKey));
    for (const d of defaults) {
      if (!present.has(d.descriptionKey)) filters.push({ ...d, enabled: true, id: randomUUID() });
    }
    this.store.set('filters', filters);
    this.emitChange();
    return defaults.length;
  }

  public deleteAllCustom(): { filters: number; folders: number } {
    const all = this.getFilters();
    const kept = all.filter(f => f.descriptionKey && !f.folder);
    const folders = this.getCustomFolders().length;
    this.store.set('filters', kept);
    this.store.set('customFolders', []);
    this.emitChange();
    return { filters: all.length - kept.length, folders };
  }

  public exportCustomFilters(): Array<Omit<FilterRule, 'id' | 'folder' | 'descriptionKey'>> {
    return this.getFilters()
      .filter(f => !f.descriptionKey)
      .map(f => ({
        category: f.category,
        description: f.description,
        pattern: f.pattern,
        replacement: f.replacement,
        useRegex: f.useRegex,
        caseSensitive: f.caseSensitive,
        enabled: f.enabled
      }));
  }
}

export function resolveDefaultFiltersPath(baseDir: string): string {
  return path.join(baseDir, '..', 'default-filters.json');
}
