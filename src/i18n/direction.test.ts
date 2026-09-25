import { describe, expect, it, beforeEach } from 'vitest';
import { applyDocumentDirection, isRtlLanguage } from './direction';

describe('writing direction', () => {
  it('knows which of the shipped languages is right-to-left', () => {
    expect(isRtlLanguage('ar')).toBe(true);
    expect(isRtlLanguage('ar-EG')).toBe(true);
    expect(isRtlLanguage('AR')).toBe(true);
    for (const lng of ['en', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'tr']) {
      expect(isRtlLanguage(lng)).toBe(false);
    }
  });

  it('treats a missing language as English', () => {
    expect(isRtlLanguage(undefined)).toBe(false);
  });

  describe('on <html>', () => {
    beforeEach(() => {
      document.documentElement.removeAttribute('dir');
      document.documentElement.removeAttribute('lang');
    });

    it('sets dir=rtl and lang for Arabic', () => {
      applyDocumentDirection('ar');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(document.documentElement.getAttribute('lang')).toBe('ar');
    });

    it('sets dir=ltr for the other languages', () => {
      applyDocumentDirection('de-DE');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(document.documentElement.getAttribute('lang')).toBe('de');
    });

    it('switches back when the language changes', () => {
      applyDocumentDirection('ar');
      applyDocumentDirection('en');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    });
  });
});
