import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export interface Shortcut {
  key: string;
  label: string;
  descriptionKey: string;
  category: 'navigation' | 'actions' | 'general';
  /** Routes where this shortcut is active. Empty = everywhere. */
  views?: string[];
}

export const SHORTCUTS: Shortcut[] = [
  // Navigation
  { key: 'g s', label: 'G → S', descriptionKey: 'shortcuts.nav.studies', category: 'navigation' },
  { key: 'g u', label: 'G → U', descriptionKey: 'shortcuts.nav.upload', category: 'navigation' },
  { key: 'g a', label: 'G → A', descriptionKey: 'shortcuts.nav.activity', category: 'navigation' },
  { key: 'g l', label: 'G → L', descriptionKey: 'shortcuts.nav.auditLogs', category: 'navigation' },
  { key: 'g w', label: 'G → W', descriptionKey: 'shortcuts.nav.worklists', category: 'navigation' },
  { key: 'g r', label: 'G → R', descriptionKey: 'shortcuts.nav.remoteSources', category: 'navigation' },
  { key: 'g e', label: 'G → E', descriptionKey: 'shortcuts.nav.settings', category: 'navigation' },
  // Actions — global
  { key: '/', label: '/', descriptionKey: 'shortcuts.actions.focusSearch', category: 'actions' },
  { key: 'Escape', label: 'Esc', descriptionKey: 'shortcuts.actions.escape', category: 'actions' },
  { key: 'e', label: 'E', descriptionKey: 'shortcuts.actions.export', category: 'actions' },
  { key: 'r', label: 'R', descriptionKey: 'shortcuts.actions.refresh', category: 'actions' },
  { key: 'n', label: 'N', descriptionKey: 'shortcuts.actions.new', category: 'actions' },
  // Actions — study list
  { key: 't', label: 'T', descriptionKey: 'shortcuts.actions.toggleFilters', category: 'actions', views: ['/studies'] },
  { key: 'c', label: 'C', descriptionKey: 'shortcuts.actions.toggleColumns', category: 'actions', views: ['/studies'] },
  // General
  { key: '?', label: '?', descriptionKey: 'shortcuts.general.showHelp', category: 'general' },
];

/**
 * Global keyboard shortcut handler.
 * @param onToggleHelp callback to open/close the shortcuts help dialog
 */
export function useKeyboardShortcuts(onToggleHelp: () => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

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

    function clickBySelector(selectors: string): boolean {
      const el = document.querySelector<HTMLElement>(selectors);
      if (el) {
        el.click();
        return true;
      }
      return false;
    }

    function focusBySelector(selectors: string): boolean {
      const el = document.querySelector<HTMLElement>(selectors);
      if (el) {
        el.focus();
        return true;
      }
      return false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Skip if inside an input (except Escape)
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
          'input[placeholder*="Search"], input[placeholder*="search"], input[placeholder*="Such"], input[placeholder*="Поиск"], input[placeholder*="搜索"], input[placeholder*="検索"]'
        );
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          return;
        }
      }

      // Escape → blur search / close dialogs
      if (e.key === 'Escape') {
        if (isInputFocused()) {
          (document.activeElement as HTMLElement)?.blur();
          return;
        }
        // Close any open dialog by clicking the overlay
        const overlay = document.querySelector('[data-radix-dialog-overlay]') as HTMLElement;
        if (overlay) {
          overlay.click();
          return;
        }
        // Close column config dropdown on studies page
        const colConfig = document.querySelector('[data-col-config-open]');
        if (colConfig) {
          (colConfig as HTMLElement).click();
          return;
        }
        return;
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
          l: '/audit-logs',
          w: '/worklists',
          r: '/remote-sources',
          e: '/settings',
        };
        const target = routes[e.key];
        if (target && location.pathname !== target) {
          e.preventDefault();
          navigate(target);
        }
        return;
      }

      // Single-key shortcuts (no modifiers)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const path = location.pathname;

      // e → Export (activity CSV, audit logs JSON)
      if (e.key === 'e') {
        if (path === '/activity') {
          // Activity export CSV button
          if (clickBySelector('button:has(.lucide-file-down)')) {
            e.preventDefault();
            return;
          }
        }
        if (path === '/audit-logs') {
          // Audit logs export JSON button
          if (clickBySelector('button:has(.lucide-download)')) {
            e.preventDefault();
            return;
          }
        }
      }

      // r → Refresh (reload current view's data)
      if (e.key === 'r') {
        // Click any visible refresh button
        const refreshBtn = document.querySelector<HTMLElement>(
          'button:has(.lucide-refresh-cw):not([disabled])'
        );
        if (refreshBtn) {
          refreshBtn.click();
          e.preventDefault();
          return;
        }
      }

      // n → New / Add (add modality, add server, upload worklist)
      if (e.key === 'n') {
        if (path === '/settings') {
          // Add modality or add server depending on active tab
          if (clickBySelector('button:has(.lucide-plus):not([disabled])')) {
            e.preventDefault();
            return;
          }
        }
        if (path === '/worklists') {
          // Upload worklist button
          if (clickBySelector('button:has(.lucide-upload):not([disabled])')) {
            e.preventDefault();
            return;
          }
        }
      }

      // t → Toggle filters (studies page)
      if (e.key === 't' && path === '/studies') {
        // The filter toggle button contains a Filter icon
        const filterBtn = document.querySelector<HTMLElement>(
          'button:has(.lucide-filter):not([disabled])'
        );
        if (filterBtn) {
          filterBtn.click();
          e.preventDefault();
          return;
        }
      }

      // c → Toggle columns (studies page)
      if (e.key === 'c' && path === '/studies') {
        // The columns toggle button contains a Settings2 icon
        const colBtn = document.querySelector<HTMLElement>(
          'button:has(.lucide-settings-2):not([disabled])'
        );
        if (colBtn) {
          colBtn.click();
          e.preventDefault();
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(gTimer);
    };
  }, [navigate, location.pathname, onToggleHelp, t]);
}
