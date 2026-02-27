import zh from './zh.json';
import en from './en.json';

export const languages = { zh: '中文', en: 'English' } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'zh';

const ui = { zh, en } as const;

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang in ui) return lang as Lang;
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: string): string {
    const keys = key.split('.');
    let val: unknown = ui[lang];
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = (val as Record<string, unknown>)[k];
      } else {
        // Fallback to default language
        val = ui[defaultLang];
        for (const fk of keys) {
          if (val && typeof val === 'object' && fk in val) {
            val = (val as Record<string, unknown>)[fk];
          } else {
            return key;
          }
        }
        break;
      }
    }
    return typeof val === 'string' ? val : key;
  };
}

export function useTranslatedPath(lang: Lang) {
  return function translatePath(path: string): string {
    return `/${lang}${path.startsWith('/') ? path : '/' + path}`;
  };
}

export function getOtherLang(lang: Lang): Lang {
  return lang === 'zh' ? 'en' : 'zh';
}
