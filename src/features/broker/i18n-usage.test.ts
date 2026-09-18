/**
 * Guard: the broker UI must use react-i18next, not a home-grown translator.
 *
 * In another project a custom `t()` helper crept in and every call site had to
 * be reworked later. This test reads the broker sources and fails when
 *
 *   - a component with translations does not import `useTranslation`,
 *   - a file defines its own translation helper (`function t(`, `const t = (`),
 *   - a component talks to the global i18n instance instead of the hook.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Vitest does not provide `import.meta.dirname` — derive it from the module URL
const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_DIR = HERE;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) return [];
    return [path];
  });
}

const PROJECT_ROOT = join(HERE, '..', '..', '..');
const files = sourceFiles(BROKER_DIR).map((path) => ({
  path: relative(PROJECT_ROOT, path),
  source: readFileSync(path, 'utf8'),
}));

describe('broker i18n usage', () => {
  it('finds the broker sources', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('uses useTranslation wherever text is translated', () => {
    const offenders = files
      .filter(({ source }) => /t\('broker\./.test(source) || /t\(`broker\./.test(source))
      .filter(({ source }) => !source.includes("from 'react-i18next'"));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('never defines its own translation helper', () => {
    const offenders = files.filter(({ source }) =>
      /function\s+t\s*\(/.test(source)
      || /const\s+t\s*=\s*\(/.test(source)
      || /useTranslate\b/.test(source));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('does not reach for the global i18n instance in components', () => {
    const offenders = files.filter(({ source }) =>
      /i18n\.t\(/.test(source) || /from 'i18next'/.test(source));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('keeps every referenced broker key in the English reference file', () => {
    const en = JSON.parse(
      readFileSync(join(PROJECT_ROOT, 'src', 'i18n', 'locales', 'en.json'), 'utf8'),
    ) as { broker: Record<string, unknown> };

    const referenced = new Set<string>();
    for (const { source } of files) {
      for (const match of source.matchAll(/t\(\s*['"`](broker\.[A-Za-z0-9_]+)['"`]/g)) {
        referenced.add(match[1].slice('broker.'.length));
      }
      // dynamic keys like t(`broker.setting_${key}`) are checked by prefix
      for (const match of source.matchAll(/t\(\s*`(broker\.[A-Za-z0-9_]+)_\$\{/g)) {
        const prefix = match[1].slice('broker.'.length);
        const exists = Object.keys(en.broker).some((key) => key.startsWith(`${prefix}_`));
        expect(exists, `no key starts with ${prefix}_`).toBe(true);
      }
    }

    const missing = [...referenced].filter((key) => !(key in en.broker));
    expect(missing).toEqual([]);
  });
});
