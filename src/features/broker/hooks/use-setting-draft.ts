/**
 * Draft handling for settings that live in a card (no explicit Save button).
 *
 * Cards used to write on every keystroke: typing "/var/lib/mwl" fired six
 * requests, five of them invalid, and the audit log filled up with noise. This
 * hook keeps a local draft, shows a validation hint while the value is not
 * valid yet, and commits on blur — one write per edit, and the operator can
 * type a path character by character.
 */
import { useState } from 'react';
import type { BrokerSetting } from '@/api/broker';
import { validateSetting } from '../lib/setting-rules';

export function useSettingDraft(
  byKey: Map<string, BrokerSetting>,
  commit: (key: string, value: string) => void,
) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const stored = (key: string) => byKey.get(key)?.value ?? '';

  const value = (key: string) => drafts[key] ?? stored(key);

  const error = (key: string): string | null => {
    const setting = byKey.get(key);
    return setting ? validateSetting(setting, value(key)) : null;
  };

  const change = (key: string, next: string) => {
    setDrafts((current) => ({ ...current, [key]: next }));
  };

  const discard = (key: string) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  /** Save the draft if it is valid and actually different. */
  const save = (key: string) => {
    if (error(key)) return false;           // keep the draft, the hint stays visible
    const next = value(key);
    if (next === stored(key)) {
      discard(key);
      return false;
    }
    commit(key, next);
    discard(key);
    return true;
  };

  const dirty = (key: string) => value(key) !== stored(key);

  return { value, error, change, save, discard, dirty };
}
