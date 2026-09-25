import * as fs from 'fs';
import * as path from 'path';

type Dict = { [key: string]: any };

function deepMerge(base: Dict, override: Dict): Dict {
  const out: Dict = { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object'
      ? deepMerge(base[k], v)
      : v;
  }
  return out;
}

export class LocaleManager {
  private currentLocale = 'en';
  private fallback: Dict = {};
  private translations: Dict = {};
  private localesPath: string;
  private available: string[] | null = null;

  constructor() {
    this.localesPath = path.join(__dirname, '..', 'locales');
    this.fallback = this.read('en') || {};
    this.translations = this.fallback;
  }

  private read(locale: string): Dict | null {
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) return null;
    try {
      const content = fs.readFileSync(path.join(this.localesPath, `${locale}.json`), 'utf-8');
      return JSON.parse(content.replace(/^﻿/, ''));
    } catch (error) {
      console.error(`Failed to load locale ${locale}:`, error);
      return null;
    }
  }

  public setLocale(locale: string): void {
    if (locale === this.currentLocale && this.translations) return;
    const data = locale === 'en' ? this.fallback : this.read(locale);
    if (!data) return;
    // Missing keys fall back to English
    this.translations = locale === 'en' ? this.fallback : deepMerge(this.fallback, data);
    this.currentLocale = locale;
  }

  public getLocale(): string {
    return this.currentLocale;
  }

  public getAll(): Dict {
    return this.translations;
  }

  public getAvailableLocales(): string[] {
    if (this.available) return this.available;
    try {
      this.available = fs.readdirSync(this.localesPath)
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''))
        .sort();
    } catch {
      this.available = ['en'];
    }
    return this.available;
  }

  /** Picks the best available locale for the OS language (e.g. "fr-FR" -> "fr"). */
  public matchSystemLocale(systemLocale: string): string {
    const short = (systemLocale || 'en').slice(0, 2).toLowerCase();
    return this.getAvailableLocales().includes(short) ? short : 'en';
  }

  public t(key: string, params?: { [key: string]: string | number }): string {
    let value: any = this.translations;
    for (const k of key.split('.')) {
      if (value && typeof value === 'object' && k in value) value = value[k];
      else return key;
    }
    if (typeof value !== 'string') return key;
    if (!params) return value;
    return value.replace(/\{(\w+)\}/g, (match, paramKey) =>
      params[paramKey] !== undefined ? String(params[paramKey]) : match);
  }
}

export const localeManager = new LocaleManager();
