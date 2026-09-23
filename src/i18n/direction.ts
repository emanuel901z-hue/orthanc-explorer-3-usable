/**
 * Writing direction of the shipped languages.
 *
 * Nine languages are offered and one of them — Arabic — is written
 * right-to-left. Without this the Arabic UI renders left-to-right: the sidebar
 * stays on the left, the punctuation of mixed strings ends up in the wrong
 * place and the whole layout looks mirrored. Setting `dir` on <html> is the
 * baseline the browser (and every `ms-`/`me-`/`start-`/`end-` utility) needs.
 */
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

/** Language code without the region: `ar-EG` → `ar`. */
function baseLanguage(language: string | undefined): string {
  return (language ?? 'en').split('-')[0].toLowerCase();
}

export function isRtlLanguage(language: string | undefined): boolean {
  return RTL_LANGUAGES.includes(baseLanguage(language));
}

/**
 * Reflect the language on <html>: `lang` for screen readers and spell checkers,
 * `dir` for the layout. Safe to call in tests (no document → no-op).
 */
export function applyDocumentDirection(language: string | undefined): void {
  if (typeof document === 'undefined') return;
  const base = baseLanguage(language);
  const root = document.documentElement;
  root.setAttribute('lang', base);
  root.setAttribute('dir', isRtlLanguage(base) ? 'rtl' : 'ltr');
}
