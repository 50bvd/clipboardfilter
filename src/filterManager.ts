// ==================================================
// CLIPBOARDFILTER - Filter Manager
// Main filter management and text processing engine
// ==================================================

import Store from 'electron-store';
import * as fs from 'fs';
import * as path from 'path';

// Filter rule interface
export interface FilterRule {
  id: string;
  descriptionKey: string;
  description?: string;
  pattern: string;
  replacement: string;
  useRegex: boolean;
  enabled: boolean;
  category: string;
  subcategory?: string;
  folder?: string;
}

// Custom folder interface
export interface CustomFolder {
  id: string;
  name: string;
  icon?: string;
  expanded?: boolean;
}

// Application settings interface
export interface AppSettings {
  language: string;
  autoStart: boolean;
  notifications: boolean;
  theme: 'light' | 'dark' | 'auto';
  shortcutPaste: string;
}

// Store schema
interface StoreSchema {
  filters: FilterRule[];
  customFolders: CustomFolder[];
  settings: AppSettings;
}

// Main FilterManager class
export class FilterManager {
  private store: Store<StoreSchema>;
  private lastFilterCount: number = 0;

  constructor() {
    this.store = new Store<StoreSchema>({
      defaults: {
        filters: [],
        customFolders: [],
        settings: {
          language: 'en',
          autoStart: false,
          notifications: true,
          theme: 'auto',
          shortcutPaste: 'CommandOrControl+Shift+V'
        }
      }
    });
    
    // Load default filters on first run
    if (this.getFilters().length === 0) {
      this.store.set('filters', this.getDefaultFilters());
    }
  }

  // Load default filters from JSON file
  private getDefaultFilters(): FilterRule[] {
    try {
      const filtersPath = path.join(__dirname, '..', 'default-filters.json');
      const data = fs.readFileSync(filtersPath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.filters.map((f: any) => ({
        ...f,
        id: this.generateId()
      }));
    } catch (error) {
      console.error('[FilterManager] Error loading default filters:', error);
      return [];
    }
  }

  // Generate unique ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // === CUSTOM FOLDERS ===

  public getCustomFolders(): CustomFolder[] {
    return this.store.get('customFolders', []);
  }

  public addCustomFolder(folder: Omit<CustomFolder, 'id'>): CustomFolder {
    const newFolder: CustomFolder = {
      ...folder,
      id: this.generateId(),
      expanded: true
    };
    const folders = this.getCustomFolders();
    folders.push(newFolder);
    this.store.set('customFolders', folders);
    console.log(`[FilterManager] Created folder: ${newFolder.name} (${newFolder.id})`);
    return newFolder;
  }

  public updateCustomFolder(id: string, updates: Partial<CustomFolder>): void {
    const folders = this.getCustomFolders();
    const index = folders.findIndex(f => f.id === id);
    if (index !== -1) {
      folders[index] = { ...folders[index], ...updates };
      this.store.set('customFolders', folders);
      console.log(`[FilterManager] Updated folder: ${id}`);
    }
  }

  // FIX: Delete folder AND all filters inside
  public deleteCustomFolder(id: string): void {
    // Delete all filters in this folder
    const filters = this.getFilters().filter(f => f.folder !== id);
    this.store.set('filters', filters);
    
    // Delete the folder itself
    const folders = this.getCustomFolders().filter(f => f.id !== id);
    this.store.set('customFolders', folders);
    
    console.log(`[FilterManager] Deleted folder and its filters: ${id}`);
  }

  // === FILTERS ===

  public getFilters(): FilterRule[] {
    return this.store.get('filters', []);
  }

  public getFiltersByCategory(category: string): FilterRule[] {
    return this.getFilters().filter(f => f.category === category && !f.folder);
  }

  public getFiltersByFolder(folderId: string): FilterRule[] {
    return this.getFilters().filter(f => f.folder === folderId);
  }

  public getCategories(): string[] {
    const filters = this.getFilters();
    const categories = new Set(filters.filter(f => !f.folder).map(f => f.category));
    return Array.from(categories).sort();
  }

  public addFilter(filter: Omit<FilterRule, 'id'>): FilterRule {
    const newFilter: FilterRule = {
      ...filter,
      id: this.generateId()
    };
    const filters = this.getFilters();
    filters.push(newFilter);
    this.store.set('filters', filters);
    console.log(`[FilterManager] Added filter: ${newFilter.descriptionKey || newFilter.description}`);
    return newFilter;
  }

  public updateFilter(id: string, updates: Partial<FilterRule>): void {
    const filters = this.getFilters();
    const index = filters.findIndex(f => f.id === id);
    if (index !== -1) {
      filters[index] = { ...filters[index], ...updates };
      this.store.set('filters', filters);
      console.log(`[FilterManager] Updated filter: ${id}`);
    }
  }

  public deleteFilter(id: string): void {
    const filters = this.getFilters().filter(f => f.id !== id);
    this.store.set('filters', filters);
    console.log(`[FilterManager] Deleted filter: ${id}`);
  }

  public moveFilterToFolder(filterId: string, folderId: string | undefined): void {
    this.updateFilter(filterId, { folder: folderId });
    console.log(`[FilterManager] Moved filter ${filterId} to folder ${folderId || 'none'}`);
  }

  // === TEXT FILTERING ===

  public filterText(text: string): { filtered: string; count: number } {
    if (!text) return { filtered: text, count: 0 };

    this.lastFilterCount = 0;
    let result = text;
    const filters = this.getFilters().filter(f => f.enabled);

    for (const filter of filters) {
      if (filter.useRegex) {
        try {
          const regex = new RegExp(filter.pattern, 'gi');
          const matches = result.match(regex);
          if (matches) {
            result = result.replace(regex, filter.replacement);
            this.lastFilterCount += matches.length;
          }
        } catch (error) {
          console.error(`[FilterManager] Invalid regex: ${filter.pattern}`, error);
        }
      } else {
        const regex = new RegExp(this.escapeRegex(filter.pattern), 'gi');
        const matches = result.match(regex);
        if (matches) {
          result = result.replace(regex, filter.replacement);
          this.lastFilterCount += matches.length;
        }
      }
    }

    return { filtered: result, count: this.lastFilterCount };
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  public getLastFilterCount(): number {
    return this.lastFilterCount;
  }

  // === SETTINGS ===

  public getSettings(): AppSettings {
    return this.store.get('settings');
  }

  public updateSettings(settings: Partial<AppSettings>): void {
    const current = this.getSettings();
    this.store.set('settings', { ...current, ...settings });
    console.log(`[FilterManager] Updated settings:`, settings);
  }

  // === IMPORT/EXPORT ===

  public resetToDefaults(): void {
    this.store.set('filters', this.getDefaultFilters());
    console.log(`[FilterManager] Reset to default filters`);
  }

  public importFilters(filters: FilterRule[]): void {
    this.store.set('filters', filters);
    console.log(`[FilterManager] Imported ${filters.length} filters`);
  }

  public exportFilters(): FilterRule[] {
    return this.getFilters();
  }
}
