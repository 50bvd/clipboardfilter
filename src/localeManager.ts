import * as fs from 'fs';
import * as path from 'path';

export class LocaleManager {
  private currentLocale: string = 'en';
  private translations: { [key: string]: any } = {};
  private localesPath: string;

  constructor() {
    this.localesPath = path.join(__dirname, '..', 'locales');
    this.loadLocale(this.currentLocale);
  }

  private loadLocale(locale: string): void {
    try {
      const localePath = path.join(this.localesPath, `${locale}.json`);
      if (fs.existsSync(localePath)) {
        const content = fs.readFileSync(localePath, 'utf-8');
        this.translations = JSON.parse(content);
        this.currentLocale = locale;
      }
    } catch (error) {
      console.error(`Failed to load locale ${locale}:`, error);
    }
  }

  public setLocale(locale: string): void {
    this.loadLocale(locale);
  }

  public getLocale(): string {
    return this.currentLocale;
  }

  public getAvailableLocales(): string[] {
    try {
      const files = fs.readdirSync(this.localesPath);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      return ['en'];
    }
  }

  public t(key: string, params?: { [key: string]: string | number }): string {
    const keys = key.split('.');
    let value: any = this.translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    if (typeof value === 'string') {
      // Replace parameters like {count}
      if (params) {
        return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
          return params[paramKey] !== undefined ? String(params[paramKey]) : match;
        });
      }
      return value;
    }

    return key;
  }
}

export const localeManager = new LocaleManager();
