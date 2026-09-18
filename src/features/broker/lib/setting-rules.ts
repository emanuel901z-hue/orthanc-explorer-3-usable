/**
 * Client-side mirror of the server's setting validation.
 *
 * The broker validates every value server-side — that stays the authority. This
 * module exists so the operator sees a wrong value *before* sending it: the same
 * rules, in one place, reused by the settings page and the TLS/ATNA/alerting
 * cards. Keep it in sync with `settings_service.validate_value` (Python).
 */
import type { BrokerSetting } from '@/api/broker';

/** DICOM AE titles: 1–16 chars, A–Z 0–9 _ - */
export const AET_RE = /^[A-Z0-9_-]{1,16}$/;
/** DICOM UID: digits and dots, no leading/trailing dot */
export const UID_RE = /^[0-9]+(\.[0-9]+)*$/;

const BOOL_VALUES = new Set(['true', '1', 'yes', 'on', 'false', '0', 'no', 'off']);

/** What is wrong with this draft value? `null` = fine. */
export function validateSetting(setting: BrokerSetting, raw: string): string | null {
  const value = raw ?? '';
  const kind = setting.kind ?? 'str';

  if (kind === 'bool') {
    return BOOL_VALUES.has(value.trim().toLowerCase())
      ? null
      : 'expected a boolean (true/false)';
  }
  if (kind === 'int') {
    if (!/^-?\d+$/.test(value.trim())) return 'expected an integer';
    const number = Number(value);
    const min = setting.min ?? undefined;
    const max = setting.max ?? undefined;
    if (min !== undefined && number < min) return `must be at least ${min}`;
    if (max !== undefined && number > max) return `must be at most ${max}`;
    return null;
  }
  if (kind.startsWith('enum:')) {
    const choices = setting.choices?.length
      ? setting.choices
      : kind.split(':', 2)[1].split(',').filter(Boolean);
    return value === '' || choices.includes(value)
      ? null
      : `must be one of: ${choices.join(', ')}`;
  }
  if (kind === 'url') {
    if (!value) return null;                       // empty = disabled
    return /^https?:\/\/.+/.test(value)
      ? null
      : 'must start with http:// or https://';
  }
  if (kind === 'path') {
    if (!value) return null;
    if (!value.startsWith('/')) return 'must be an absolute path';
    if (value.split('/').includes('..')) return "must not contain '..'";
    return null;
  }
  if (kind === 'aets') {
    const bad = value.split(',').map((part) => part.trim())
      .filter((part) => part && !AET_RE.test(part));
    return bad.length ? `invalid AE title(s): ${bad.join(', ')}` : null;
  }
  return null;
}

/** Per-field checks for the node forms (sources/targets). */
export function validateNodeField(
  field: 'name' | 'aet' | 'calling_aet' | 'host' | 'port' | 'timeout_s' | 'priority',
  value: string | number,
): string | null {
  switch (field) {
    case 'name':
      return String(value).trim() ? null : 'required';
    case 'aet':
    case 'calling_aet':
      return AET_RE.test(String(value)) ? null : 'aet';
    case 'host':
      return String(value).trim() ? null : 'required';
    case 'port': {
      const port = Number(value);
      return Number.isInteger(port) && port >= 1 && port <= 65535 ? null : 'port';
    }
    default:
      return null;
  }
}
