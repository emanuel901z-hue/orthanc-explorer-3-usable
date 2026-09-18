import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSettingDraft } from './use-setting-draft';
import type { BrokerSetting } from '@/api/broker';

const setting = (over: Partial<BrokerSetting>): BrokerSetting => ({
  key: 'x', value: '', default: '', source: 'env', kind: 'str', description: '', ...over,
});

function setup(settings: BrokerSetting[]) {
  const byKey = new Map(settings.map((entry) => [entry.key, entry]));
  const commit = vi.fn();
  const hook = renderHook(() => useSettingDraft(byKey, commit));
  return { ...hook, commit, byKey };
}

describe('useSettingDraft', () => {
  it('keeps a draft and commits it on save', () => {
    const { result, commit } = setup([setting({ key: 'host', value: 'old', kind: 'str' })]);

    act(() => result.current.change('host', 'new'));
    expect(result.current.value('host')).toBe('new');
    expect(commit).not.toHaveBeenCalled();

    act(() => expect(result.current.save('host')).toBe(true));
    expect(commit).toHaveBeenCalledWith('host', 'new');
    // the draft is dropped again
    expect(result.current.value('host')).toBe('old');
  });

  it('does not commit an invalid draft but keeps it visible', () => {
    const { result, commit } = setup([setting({ key: 'path', value: '/ok', kind: 'path' })]);

    act(() => result.current.change('path', 'relative'));
    expect(result.current.error('path')).toMatch(/absolute/i);

    act(() => expect(result.current.save('path')).toBe(false));
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.value('path')).toBe('relative');   // the operator can fix it
  });

  it('does not write when nothing changed', () => {
    const { result, commit } = setup([setting({ key: 'host', value: 'same' })]);

    act(() => result.current.change('host', 'same'));
    act(() => expect(result.current.save('host')).toBe(false));
    expect(commit).not.toHaveBeenCalled();
  });

  it('reports dirtiness and can discard', () => {
    const { result } = setup([setting({ key: 'host', value: 'old' })]);

    expect(result.current.dirty('host')).toBe(false);
    act(() => result.current.change('host', 'new'));
    expect(result.current.dirty('host')).toBe(true);
    act(() => result.current.discard('host'));
    expect(result.current.dirty('host')).toBe(false);
    expect(result.current.value('host')).toBe('old');
  });
});
