import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import ar from './locales/ar.json';
import { applyDocumentDirection } from './direction';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
] as const;

export const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

/** Where the chosen language is remembered (also what the detector reads). */
export const LANGUAGE_STORAGE_KEY = 'oe3-language';

/**
 * Debugging i18next (see docs/fork-changelog.md):
 *
 * - `?lng=fr`          force a language for one visit (also what the E2E tests use)
 * - `?i18nDebug=1`     i18next logs every lookup, missing key and language change
 * - `localStorage['oe3-i18n-debug'] = '1'`   same, permanently for this browser
 * - `window.__i18n`    the instance in the console (dev only): `__i18n.t('broker.title')`
 *
 * Missing keys are logged (dev only) instead of failing silently, and the
 * fallback language fills every gap — a key that only exists in English is shown
 * in English rather than as `broker.something`.
 */
function debugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('i18nDebug') === '1') return true;
    return window.localStorage.getItem('oe3-i18n-debug') === '1';
  } catch {
    return false;
  }
}

export const I18N_DEBUG = debugEnabled();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      ja: { translation: ja },
      zh: { translation: zh },
      ru: { translation: ru },
      tr: { translation: tr },
      ar: { translation: ar },
    },
    // only the nine shipped languages; `en-GB` resolves to `en`
    supportedLngs: SUPPORTED_LANGUAGE_CODES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'en',
    // a missing key must never render as "broker.someKey"
    returnNull: false,
    debug: I18N_DEBUG,
    saveMissing: I18N_DEBUG,
    missingKeyHandler: I18N_DEBUG
      ? (lngs, ns, key) => {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] missing key "${key}" for ${lngs.join(', ')}`);
        }
      : undefined,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      // `?lng=xx` first so a link can force a language (tests, support calls),
      // then the remembered choice, then the browser setting
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      lookupQuerystring: 'lng',
      caches: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
  });

// Arabic is written right-to-left — <html dir> follows the chosen language,
// otherwise the layout stays mirrored (sidebar on the left, wrong punctuation).
applyDocumentDirection(i18n.resolvedLanguage ?? i18n.language);
i18n.on('languageChanged', (language) => applyDocumentDirection(language));

// handy in the browser console while developing
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__i18n = i18n;
}

export default i18n;
