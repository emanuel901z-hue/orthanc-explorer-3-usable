import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useKeyboardShortcuts } from './use-keyboard-shortcuts';

/* ── Test harness — renders a component that uses the hook ── */
function TestHarness({ onToggleHelp }: { onToggleHelp: () => void }) {
  useKeyboardShortcuts(onToggleHelp);
  return (
    <div>
      {/* The hook looks for [data-shortcut="search"] — this is the i18n-agnostic
          selector that replaced the old locale-specific placeholder matching. */}
      <input data-shortcut="search" type="text" placeholder="Any language" />
    </div>
  );
}

function renderHook() {
  const onToggleHelp = vi.fn();
  const result = render(
    <MemoryRouter>
      <TestHarness onToggleHelp={onToggleHelp} />
    </MemoryRouter>,
  );
  return { ...result, onToggleHelp };
}

describe('useKeyboardShortcuts — "/" focus search', () => {
  beforeEach(() => {
    // Ensure focus starts at body
    (document.activeElement as HTMLElement | null)?.blur?.();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('focuses the input with data-shortcut="search" when "/" is pressed', () => {
    const { container } = renderHook();
    const searchInput = container.querySelector('[data-shortcut="search"]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    expect(document.activeElement).not.toBe(searchInput);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
    });

    expect(document.activeElement).toBe(searchInput);
  });

  it('does NOT focus search when "/" is pressed inside an input', () => {
    const { container } = renderHook();
    const searchInput = container.querySelector('[data-shortcut="search"]') as HTMLInputElement;
    // Focus the search input first, then type "/" — should NOT refocus
    searchInput.focus();
    // Simulate typing "/" while input is focused
    const otherInput = document.createElement('input');
    document.body.appendChild(otherInput);
    otherInput.focus();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
    });

    // Focus should remain on otherInput, not jump to search
    expect(document.activeElement).toBe(otherInput);
    document.body.removeChild(otherInput);
  });

  it('opens help dialog when "?" is pressed', () => {
    const { onToggleHelp } = renderHook();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });

    expect(onToggleHelp).toHaveBeenCalledTimes(1);
  });

  it('does not trigger shortcuts when ctrl/cmd is held', () => {
    const { onToggleHelp } = renderHook();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', ctrlKey: true }));
    });

    expect(onToggleHelp).not.toHaveBeenCalled();
  });
});
