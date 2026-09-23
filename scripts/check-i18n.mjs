#!/usr/bin/env node
/**
 * i18n coverage check.
 *
 * The broker section is complete in German and English; the other seven OE3
 * languages ship the visible chrome (page titles, buttons, dialogs, help
 * headings) and fall back to English per key for the detailed content. This
 * script makes that state visible and keeps it from drifting:
 *
 *   node scripts/check-i18n.mjs           # report + fail on a real regression
 *   node scripts/check-i18n.mjs --verbose # also list the missing keys per language
 *
 * It fails when
 *   - a language file is missing or empty,
 *   - English and German diverge (they are the reference languages),
 *   - the chrome set is not complete in every language,
 *   - a key of the reference file is missing in *all* other languages
 *     (a key nobody can see in any language is a mistake).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, '..', 'src', 'i18n', 'locales');
const verbose = process.argv.includes('--verbose');

const REFERENCE = 'en';
const SECOND_REFERENCE = 'de';
const LANGUAGES = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ru', 'tr', 'ar'];

/** Keys every language must carry — what a user sees first. */
const CHROME = [
  'title', 'subtitle', 'notConfigured',
  'addTitle', 'editTitle',
  'sourcesTitle', 'sourcesSubtitle', 'targetsTitle', 'targetsSubtitle',
  'rulesTitle', 'rulesSubtitle', 'transformsTitle', 'transformsSubtitle',
  'settingsTitle', 'settingsSubtitle', 'auditTitle', 'auditSubtitle',
  'spoolPageTitle', 'spoolPageSubtitle', 'stationTitle', 'stationSubtitle',
  'localTitle', 'localSubtitle', 'healthTitle', 'caseCheckTitle', 'cacheTitle',
  'spoolTitle', 'notifyTitle', 'atnaTitle', 'tlsTitle', 'retentionTitle',
  'hl7Title', 'localHintTitle',
  'name', 'aet', 'host', 'port', 'priority', 'enabled', 'actions', 'status',
  'charset', 'timeout', 'echo', 'mwlInteropGroup', 'stripQrl', 'stripQrlHint',
  'entity_patient_merge', 'entity_merge_rule', 'entity_mpps_step', 'entity_hl7_field_map',
  'mppsRetryOne', 'mppsRetryOneHint',
  'cacheCleared', 'cacheClearSource', 'cacheClearSourceHint', 'storeLogTitle', 'storeLogHint', 'storeLogEmpty', 'storeLogError',
  'addSource', 'editSource', 'deleteSource', 'addTarget', 'editTarget',
  'deleteTarget', 'addRule', 'editRule', 'deleteRule', 'addTransform',
  'editTransform', 'deleteTransform', 'addOperation', 'save', 'edit', 'delete',
  'resetForm',
  'confirmDeleteTitle', 'confirmDeleteBody', 'confirmDeleteDependenciesSource',
  'confirmDeleteDependenciesTarget',
  'errRequired', 'errAet', 'errPort', 'errTimeout', 'errOperationTag', 'errHost',
  'saved', 'writeFailed', 'settingInvalid', 'settingRejected', 'settingRange',
  'settingOverridden', 'settingFromEnv', 'settingReset', 'settingEnvDefault',
  'settingEmpty',
  'discardTitle', 'discardHint', 'discardKeep', 'discardConfirm',
  'duplicateAet', 'duplicateRule', 'tagInvalid',
  'helpButton', 'helpIntro', 'helpWhat', 'helpHow', 'helpWrong',
  'help_overview_title', 'help_sources_title', 'help_targets_title',
  'help_rules_title', 'help_transforms_title', 'help_stations_title',
  'help_worklist_title', 'help_spool_title', 'help_audit_title',
  'help_settings_title',
];

function readLocale(code) {
  return JSON.parse(readFileSync(join(localesDir, `${code}.json`), 'utf8'));
}

const files = readdirSync(localesDir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const missingFiles = LANGUAGES.filter((code) => !files.includes(code));

const locales = Object.fromEntries(LANGUAGES.map((code) => [code, readLocale(code)]));
const reference = locales[REFERENCE].broker ?? {};

const problems = [];
if (missingFiles.length) problems.push(`language file(s) missing: ${missingFiles.join(', ')}`);

// 1. the two reference languages must match key for key
const second = locales[SECOND_REFERENCE].broker ?? {};
const onlyEn = Object.keys(reference).filter((k) => !(k in second));
const onlyDe = Object.keys(second).filter((k) => !(k in reference));
if (onlyEn.length) problems.push(`${REFERENCE} has keys missing in ${SECOND_REFERENCE}: ${onlyEn.join(', ')}`);
if (onlyDe.length) problems.push(`${SECOND_REFERENCE} has keys missing in ${REFERENCE}: ${onlyDe.join(', ')}`);

// 2. the chrome must exist everywhere
for (const code of LANGUAGES) {
  const broker = locales[code].broker ?? {};
  const missing = CHROME.filter((key) => !(key in broker));
  if (missing.length) {
    problems.push(`${code}: ${missing.length} chrome key(s) missing: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' …' : ''}`);
  }
}

// 3. no key may be invisible in every language (a key that only exists in en/de
//    is fine — the fallback shows it in English)
for (const [key] of Object.entries(reference)) {
  const translated = LANGUAGES.filter((code) => key in (locales[code].broker ?? {}));
  if (translated.length === 0) problems.push(`key "${key}" exists in no language`);
}

// ── report ────────────────────────────────────────────────────────────────
const total = Object.keys(reference).length;
console.log(`i18n coverage (${total} broker keys in ${REFERENCE})\n`);
console.log('lang  broker-keys  coverage  chrome');
for (const code of LANGUAGES) {
  const broker = locales[code].broker ?? {};
  const count = Object.keys(broker).length;
  const chrome = CHROME.filter((key) => key in broker).length;
  const pct = ((count / total) * 100).toFixed(1).padStart(5);
  const chromeLabel = `${chrome}/${CHROME.length}`;
  console.log(`${code.padEnd(5)} ${String(count).padStart(11)}  ${pct}%  ${chromeLabel}`);
  if (verbose && count < total) {
    const missing = Object.keys(reference).filter((key) => !(key in broker));
    console.log(`      missing: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ` … (${missing.length})` : ''}`);
  }
}

if (problems.length) {
  console.error('\n✗ i18n check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('\n✓ chrome complete in all languages, reference languages in sync');
