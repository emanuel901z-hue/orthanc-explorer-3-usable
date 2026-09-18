import { describe, it, expect } from 'vitest';
import { validateSetting, validateNodeField, AET_RE, UID_RE } from './setting-rules';
import type { BrokerSetting } from '@/api/broker';

const setting = (over: Partial<BrokerSetting>): BrokerSetting => ({
  key: 'x', value: '', default: '', source: 'env', kind: 'str', description: '', ...over,
});

describe('validateSetting — the same rules the server applies', () => {
  it('accepts and rejects booleans', () => {
    const bool = setting({ kind: 'bool' });
    for (const value of ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']) {
      expect(validateSetting(bool, value)).toBeNull();
    }
    expect(validateSetting(bool, 'maybe')).toMatch(/boolean/i);
  });

  it('enforces integer bounds', () => {
    const int = setting({ kind: 'int', min: 5, max: 3600 });
    expect(validateSetting(int, '30')).toBeNull();
    expect(validateSetting(int, 'abc')).toMatch(/integer/i);
    expect(validateSetting(int, '4')).toMatch(/at least 5/);
    expect(validateSetting(int, '9999')).toMatch(/at most 3600/);
  });

  it('accepts only the enum choices', () => {
    const pick = setting({ kind: 'enum:off,enforce', choices: ['off', 'enforce'] });
    expect(validateSetting(pick, 'enforce')).toBeNull();
    expect(validateSetting(pick, '')).toBeNull();          // empty = default
    expect(validateSetting(pick, 'maybe')).toMatch(/must be one of/i);
  });

  it('checks URLs only when something is entered', () => {
    const url = setting({ kind: 'url' });
    expect(validateSetting(url, '')).toBeNull();            // off
    expect(validateSetting(url, 'https://hooks.example/x')).toBeNull();
    expect(validateSetting(url, 'hooks.example')).toMatch(/http/i);
  });

  it('requires absolute paths without traversal', () => {
    const path = setting({ kind: 'path' });
    expect(validateSetting(path, '')).toBeNull();
    expect(validateSetting(path, '/var/lib/mwl-broker/tls')).toBeNull();
    expect(validateSetting(path, 'relative.crt')).toMatch(/absolute/i);
    expect(validateSetting(path, '/var/../etc/passwd')).toMatch(/\.\./);
  });

  it('checks every AE title in a list', () => {
    const aets = setting({ kind: 'aets' });
    expect(validateSetting(aets, 'CT_01,MR_01')).toBeNull();
    expect(validateSetting(aets, '')).toBeNull();
    expect(validateSetting(aets, 'CT_01,nope!')).toMatch(/invalid ae title/i);
  });

  it('leaves free text alone', () => {
    expect(validateSetting(setting({ kind: 'str' }), 'anything at all')).toBeNull();
  });
});

describe('validateNodeField', () => {
  it('checks the node form fields', () => {
    expect(validateNodeField('name', 'ris-a')).toBeNull();
    expect(validateNodeField('name', '  ')).toBe('required');
    expect(validateNodeField('aet', 'RIS_A')).toBeNull();
    expect(validateNodeField('aet', 'ris-a!')).toBe('aet');
    expect(validateNodeField('host', '10.0.1.30')).toBeNull();
    expect(validateNodeField('port', 2762)).toBeNull();
    expect(validateNodeField('port', 0)).toBe('port');
    expect(validateNodeField('port', 65536)).toBe('port');
  });

  it('exposes the patterns used across the broker UI', () => {
    expect(AET_RE.test('CT_01')).toBe(true);
    expect(AET_RE.test('ct_01')).toBe(false);        // must be upper case
    expect(UID_RE.test('1.2.840.10008.5.1.4.31')).toBe(true);
    expect(UID_RE.test('1.2.840..5')).toBe(false);
  });
});
