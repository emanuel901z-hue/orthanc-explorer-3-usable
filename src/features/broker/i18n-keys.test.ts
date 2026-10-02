/**
 * Every broker translation key has to be reachable — and every key the code
 * names has to exist.
 *
 * Dead keys are not harmless: they are translated nine times, they turn up in
 * every review, and they hide the key that *should* have been used. The breaker
 * badge read `breakerState_open` in the locale for a while while the live key
 * was `breakerOpen`; `echoOk`/`echoFail` did the same next to `echoFailed`.
 * Nobody noticed, because nothing looked.
 *
 * Keys are built dynamically in two shapes, so the check has to know both:
 *
 *   t(`broker.setting_${key}`)     → a **prefix** family ("setting_")
 *   t(`broker.${kind}EditTitle`)   → a **suffix** family ("EditTitle")
 *
 * One call site builds a key from a variable without either shape (the local
 * worklist form errors: `t(`broker.${fieldErrors[key]}`)`). Its possible values
 * are listed below — if that list grows, this one has to grow with it, which is
 * the point of writing it down.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..');
const LOCALES = join(SRC, 'i18n', 'locales');

/**
 * Keys the shared OE3 chrome requires (see `scripts/check-i18n.mjs` → CHROME).
 * They live in the broker section because the broker owns their wording, but the
 * base uses them — "unused in this slice" is not the same as unused.
 */
const CHROME_KEYS = ['resetForm'];

/** Values of `t(`broker.${fieldErrors[key]}`)` in LocalWorklistPage.tsx. */
const KEYS_FROM_A_VARIABLE = [
  'localAccessionRequired',
  'localStationInvalid',
  'localUidInvalid',
  // the shared PageHelp builds its keys from the `prefix` prop
  // (`t(`${prefix}.i18nNote`)`), so the broker variant is not a literal anywhere
  'i18nNote',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) return [];
    return [path];
  });
}

const sources = [
  ...sourceFiles(HERE).map((path) => readFileSync(path, 'utf8')),
  readFileSync(join(SRC, 'api', 'broker.ts'), 'utf8'),
  // the shared help component builds both sections' keys from its `prefix` prop
  readFileSync(join(SRC, 'shared', 'components', 'PageHelp.tsx'), 'utf8'),
  // the error sentences are built from the status code (`errors.http${status}`)
  readFileSync(join(SRC, 'lib', 'errors.ts'), 'utf8'),
].join('\n');

const locale = JSON.parse(readFileSync(join(LOCALES, 'en.json'), 'utf8'));
const broker = locale.broker as Record<string, unknown>;
/** The shared help texts of the base pages live in their own section. */
const baseHelp = locale.help as Record<string, unknown>;
/** Error sentences (translated at the source, see `src/lib/errors.ts`). */
const errorTexts = locale.errors as Record<string, unknown>;
const keys = Object.keys(broker);

/** `t(\`broker.xyz_${...}\`)` → the prefix "xyz_". */
const prefixFamilies = new Set(
  [...sources.matchAll(/broker\.(\w+_)\$\{/g)].map((m) => m[1]),
);
/** `t(\`broker.${...}Suffix\`)` → the suffix "Suffix". */
const suffixFamilies = new Set(
  [...sources.matchAll(/broker\.\$\{\w+\}(\w+)/g)].map((m) => m[1]),
);
/**
 * Keys the shared `PageHelp` builds from its `prefix` prop: `${prefix}.helpWhat`
 * and `${prefix}.help_${helpId}_what` — neither is a literal anywhere.
 */
const prefixBuilt = new Set(
  [...sources.matchAll(/\$\{prefix\}\.(\w+)(?!\$\{)/g)].map((m) => m[1]),
);
const prefixBuiltFamilies = new Set(
  [...sources.matchAll(/\$\{prefix\}\.(\w+)\$\{/g)].map((m) => m[1]),
);

/** Quoted `"<section>.X"` literals — for sections that name their keys. */
const literalsOf = (section: string) =>
  new Set([...sources.matchAll(new RegExp(`['"\`]${section}\\.(\\w+)['"\`]`, 'g'))]
    .map((m) => m[1]));
const errorLiterals = literalsOf('errors');
/** `errors.http${status}` in `src/lib/errors.ts` → the prefix "http". */
const errorFamilies = new Set(
  [...sources.matchAll(/errors\.(\w+)\$\{/g)].map((m) => m[1]),
);

/** Keys that appear as a whole string literal somewhere. */
/**
 * Forward direction: any quoted `broker.X` counts as reachable — the pages pass
 * titles as props (`titleKey="broker.sourcesTitle"`), not through `t()`.
 */
const referencedKeys = new Set(
  [...sources.matchAll(/['"`]broker\.(\w+)['"`]/g)].map((m) => m[1]),
);
/**
 * Reverse direction: only a real `t('broker.X')` call means the key has to
 * exist. The loose pattern above would also match `usePersistedState(
 * 'broker.logSince')` — a storage key, not a translation.
 */
const tCallKeys = new Set(
  [...sources.matchAll(/\bt\(\s*['"`]broker\.(\w+)['"`]/g)].map((m) => m[1]),
);

describe('broker translation keys', () => {
  it('finds the sources and the locale', () => {
    expect(keys.length).toBeGreaterThan(500);
    expect(prefixFamilies.size).toBeGreaterThan(10);
    expect(suffixFamilies.size).toBeGreaterThanOrEqual(2);
  });

  const unreachableKeys = (candidate: string[]) => candidate.filter((key) => {
      if (referencedKeys.has(key) || KEYS_FROM_A_VARIABLE.includes(key)) return false;
      if (prefixBuilt.has(key)) return false;
      if ([...prefixFamilies].some((prefix) => key.startsWith(prefix))) return false;
      if (CHROME_KEYS.includes(key)) return false;
    if ([...prefixBuiltFamilies].some((prefix) => key.startsWith(prefix))) return false;
    if ([...suffixFamilies].some((suffix) => key.endsWith(suffix))) return false;
    return true;
  });

  it('has no broker key that nothing can reach', () => {
    const unreachable = unreachableKeys(keys);
    expect(unreachable, `dead keys (remove them or use them): ${unreachable.join(', ')}`)
      .toEqual([]);
  });

  it('has no base help key that nothing can reach', () => {
    const unreachable = unreachableKeys(Object.keys(baseHelp));
    expect(unreachable, `dead help keys: ${unreachable.join(', ')}`).toEqual([]);
  });

  it('has no error sentence that nothing can reach', () => {
    // `errors.http403` is built as `errors.http${status}`; the two exceptions are
    // the ones a module asks for by name (`translated(...)`)
    const unreachable = Object.keys(errorTexts).filter((key) => {
      if (errorLiterals.has(key)) return false;                 // 'errors.http400'
      if ([...errorFamilies].some((prefix) => key.startsWith(prefix))) return false;
      return unreachableKeys([key]).length > 0;
    });
    expect(unreachable, `dead error texts: ${unreachable.join(', ')}`).toEqual([]);
  });

  it('has a translation for every key the code names', () => {
    // the other direction: a renamed key must not silently fall back to the
    // raw code in the UI
    const missing = [...tCallKeys].filter((key) => !(key in broker));

    expect(missing, `keys used in the code but missing in en.json: ${missing.join(', ')}`)
      .toEqual([]);
  });

  it('keeps the reference languages in sync for the broker keys', () => {
    const de = JSON.parse(readFileSync(join(LOCALES, 'de.json'), 'utf8')).broker as Record<string, unknown>;
    expect(Object.keys(de).sort()).toEqual(keys.slice().sort());
  });
});
