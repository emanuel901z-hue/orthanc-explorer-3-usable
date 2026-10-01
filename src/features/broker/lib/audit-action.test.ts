import { describe, it, expect } from 'vitest';
import { auditActionKey } from './audit-action';

describe('auditActionKey', () => {
  it('turns the code into an i18next key', () => {
    expect(auditActionKey('update.setting')).toBe('broker.action_update_setting');
    expect(auditActionKey('import.ups_subscription'))
      .toBe('broker.action_import_ups_subscription');
  });

  it('keeps a dash — the code has one too (hl7.cancel-unknown)', () => {
    expect(auditActionKey('hl7.cancel-unknown'))
      .toBe('broker.action_hl7_cancel-unknown');
  });

  it('survives an empty code instead of building a broken key', () => {
    expect(auditActionKey('')).toBe('broker.action_');
  });
});
