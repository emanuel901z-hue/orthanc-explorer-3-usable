import { describe, it, expect } from 'vitest';
import i18n, { SUPPORTED_LANGUAGES, SUPPORTED_LANGUAGE_CODES, I18N_DEBUG } from './index';

import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import ar from './locales/ar.json';

const LOCALES: Record<string, { broker: Record<string, unknown> }> = {
  en, de, es, fr, ja, zh, ru, tr, ar,
};

/** What a user sees first — must exist in every language (see scripts/check-i18n.mjs). */
const CHROME = [
  'title', 'subtitle', 'sourcesTitle',
  'addTitle', 'editTitle', 'targetsTitle', 'rulesTitle',
  'transformsTitle', 'settingsTitle', 'auditTitle', 'spoolPageTitle',
  'stationTitle', 'localTitle', 'name', 'aet', 'host', 'port', 'priority',
  'enabled', 'actions', 'save', 'edit', 'delete', 'addSource', 'addRule',
  'confirmDeleteTitle', 'confirmDeleteBody', 'errRequired', 'errAet', 'errHost',
  'saved', 'writeFailed', 'discardTitle', 'discardConfirm', 'duplicateAet',
  'helpButton', 'helpWhat', 'helpHow', 'helpWrong',
];

describe('i18n setup', () => {
  it('registers exactly the nine supported languages', () => {
    expect(SUPPORTED_LANGUAGE_CODES).toEqual(['en', 'es', 'fr', 'de', 'ja', 'zh', 'ru', 'tr', 'ar']);
    expect(SUPPORTED_LANGUAGES).toHaveLength(9);
    for (const language of SUPPORTED_LANGUAGES) {
      expect(i18n.hasResourceBundle(language.code, 'translation')).toBe(true);
    }
  });

  it('resolves regional variants to the base language (en-GB → en)', async () => {
    await i18n.changeLanguage('en-GB');
    expect(i18n.resolvedLanguage).toBe('en');
    await i18n.changeLanguage('de');
  });

  it('falls back to English per key instead of showing the raw key', () => {
    // the detailed help body only exists in en/de — French must show English
    const french = i18n.t('broker.help_sources_what', { lng: 'fr', returnObjects: true });
    expect(Array.isArray(french)).toBe(true);
    expect((french as string[]).length).toBeGreaterThan(0);
    expect((french as string[])[0]).toMatch(/RIS/i);
    // a raw key would look like "broker.helpSourcesWhat" — a sentence ending in
    // "the broker." is fine
    expect(String(french)).not.toMatch(/broker\.[a-zA-Z]/);
  });

  it('never renders a raw key, in any language', () => {
    for (const code of SUPPORTED_LANGUAGE_CODES) {
      for (const key of ['broker.title', 'broker.sourcesTitle', 'broker.save',
                         'broker.helpButton', 'broker.discardTitle', 'broker.errRequired']) {
        const text = String(i18n.t(key, { lng: code }));
        expect(text, `${key} in ${code}`).not.toBe(key);
        expect(text.length, `${key} in ${code}`).toBeGreaterThan(0);
      }
    }
  });

  it('translates the chrome into every language', () => {
    for (const code of SUPPORTED_LANGUAGE_CODES) {
      const broker = LOCALES[code].broker;
      const missing = CHROME.filter((key) => !(key in broker));
      expect(missing, `${code} misses chrome keys`).toEqual([]);
    }
  });

  it('keeps the two reference languages in sync', () => {
    const enKeys = Object.keys(en.broker).sort();
    const deKeys = Object.keys(de.broker).sort();
    expect(deKeys).toEqual(enKeys);
  });

  it('does not show the English text for a translated chrome key', () => {
    // spot checks: the chrome is really translated, not copied
    expect(i18n.t('broker.sourcesTitle', { lng: 'fr' })).not.toBe(en.broker.sourcesTitle);
    expect(i18n.t('broker.sourcesTitle', { lng: 'ja' })).not.toBe(en.broker.sourcesTitle);
    expect(i18n.t('broker.sourcesTitle', { lng: 'ar' })).not.toBe(en.broker.sourcesTitle);
    expect(i18n.t('broker.save', { lng: 'es' })).toBe(es.broker.save);
  });

  it('keeps the debug logging off unless it was asked for', () => {
    // no ?i18nDebug=1 and no localStorage flag in the test environment
    expect(I18N_DEBUG).toBe(false);
  });
});
