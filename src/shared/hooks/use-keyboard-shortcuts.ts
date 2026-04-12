import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface Shortcut {
  key: string;
  label: string;
  description: string;
  category: 'navigation' | 'actions' | 'general';
}

export const SHORTCUTS: Shortcut[] = [
  // Navigation
  { key: 'g s', label: 'G → S', description: 'Go to Studies', category: 'navigation' },
  { key: 'g u', label: 'G → U', description: 'Go to Upload', category: 'navigation' },
  { key: 'g a', label: 'G → A', description: 'Go to Activity', category: 'navigation' },
  { key: 'g r', label: 'G → R', description: 'Go to Remote Sources', category: 'navigation' },
  { key: 'g e', label: 'G → E', description: 'Go to Settings', category: 'navigation' },
  // Actions
  { key: '/', label: '/', description: 'Focus search', category: 'actions' },
  { key: 'Escape', label: 'Esc', description: 'Close dialog / deselect', category: 'actions' },
  // General
  { key: '?', label: '?', description: 'Show keyboard shortcuts', category: 'general' },
];

/**
 * Global keyboard shortcut handler.
 * @param onToggleHelp callback to open/close the shortcuts help dialog
 */
export function useKeyboardShortcuts(onToggleHelp: () => void) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let gPrefix = false;
    let gTimer: ReturnType<typeof setTimeout>;

    function isInputFocused() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (el as HTMLElement).isContentEditable
      );
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Skip if inside an input
      if (isInputFocused() && e.key !== 'Escape') return;

      // ? → help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onToggleHelp();
        return;
      }

      // / → focus search
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Search"], input[placeholder*="search"]'
        );
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          return;
        }
      }

      // Escape → blur search
      if (e.key === 'Escape') {
        if (isInputFocused()) {
          (document.activeElement as HTMLElement)?.blur();
          return;
        }
      }

      // g-prefix combos
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !gPrefix) {
        gPrefix = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => {
          gPrefix = false;
        }, 800);
        return;
      }

      if (gPrefix) {
        gPrefix = false;
        clearTimeout(gTimer);
        const routes: Record<string, string> = {
          s: '/studies',
          u: '/upload',
          a: '/activity',
          r: '/remote-sources',
          e: '/settings',
        };
        const target = routes[e.key];
        if (target && location.pathname !== target) {
          e.preventDefault();
          navigate(target);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(gTimer);
    };
  }, [navigate, location.pathname, onToggleHelp]);
}
