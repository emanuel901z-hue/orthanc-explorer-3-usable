// PHI classification: UI (no PHI — persist-safe)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function hexToHsl(hex: string): string {
  const sanitized = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(sanitized)) return '215 70% 45%';
  const r = parseInt(sanitized.substring(0, 2), 16) / 255;
  const g = parseInt(sanitized.substring(2, 4), 16) / 255;
  const b = parseInt(sanitized.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export const FONT_PRESETS = [
  { value: 'inter', label: 'Inter (Default)', stack: 'Inter, system-ui, sans-serif' },
  { value: 'system', label: 'System Default', stack: 'system-ui, -apple-system, sans-serif' },
  { value: 'segoe', label: 'Segoe UI (Windows)', stack: '"Segoe UI", Tahoma, Geneva, sans-serif' },
  { value: 'sf-pro', label: 'SF Pro (Apple)', stack: '-apple-system, BlinkMacSystemFont, sans-serif' },
  { value: 'roboto', label: 'Roboto (Android/Material)', stack: 'Roboto, "Helvetica Neue", sans-serif' },
  { value: 'noto', label: 'Noto Sans (Cross-platform)', stack: '"Noto Sans", sans-serif' },
  { value: 'custom', label: 'Custom…', stack: '' },
] as const;

export const RADIUS_PRESETS = [
  { value: '0', label: 'None (0px)' },
  { value: '0.25rem', label: 'Small (4px)' },
  { value: '0.375rem', label: 'Medium (6px)' },
  { value: '0.5rem', label: 'Default (8px)' },
  { value: '0.75rem', label: 'Large (12px)' },
  { value: '1rem', label: 'Extra Large (16px)' },
] as const;

interface UiState {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  primaryColor: string;
  accentColor: string;
  fontPreset: string;
  customFontStack: string;
  borderRadius: string;
  compactMode: boolean;
  hideSidebar: boolean;
  hideHeader: boolean;
  appName: string;
  logoUrl: string;
  dateFormat: string; // date-fns format string, default 'MMM dd, yyyy'
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setPrimaryColor: (color: string) => void;
  setAccentColor: (color: string) => void;
  setFontPreset: (preset: string) => void;
  setCustomFontStack: (stack: string) => void;
  setBorderRadius: (radius: string) => void;
  setCompactMode: (value: boolean) => void;
  setHideSidebar: (value: boolean) => void;
  setHideHeader: (value: boolean) => void;
  setAppName: (name: string) => void;
  setLogoUrl: (url: string) => void;
  setDateFormat: (format: string) => void;
  resetTheming: () => void;
  applyTheming: () => void;
}

function applyThemeStyles(state: {
  primaryColor: string;
  accentColor: string;
  fontPreset: string;
  customFontStack: string;
  borderRadius: string;
  compactMode: boolean;
}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--primary', hexToHsl(state.primaryColor));
  root.style.setProperty('--accent', hexToHsl(state.accentColor));
  root.style.setProperty('--ring', hexToHsl(state.primaryColor));
  root.style.setProperty('--radius', state.borderRadius);

  const preset = FONT_PRESETS.find((p) => p.value === state.fontPreset);
  const fontStack =
    state.fontPreset === 'custom'
      ? state.customFontStack || 'system-ui, sans-serif'
      : preset?.stack || 'Inter, system-ui, sans-serif';
  root.style.setProperty('--font-family', fontStack);
  document.body.style.fontFamily = fontStack;

  if (state.compactMode) {
    document.body.classList.add('oe3-compact');
  } else {
    document.body.classList.remove('oe3-compact');
  }
}

const DEFAULT_PRIMARY = '#2563EB';
const DEFAULT_ACCENT = '#0D9488';
const DEFAULT_RADIUS = '0.5rem';

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      sidebarCollapsed: false,
      primaryColor: DEFAULT_PRIMARY,
      accentColor: DEFAULT_ACCENT,
      fontPreset: 'inter',
      customFontStack: '',
      borderRadius: DEFAULT_RADIUS,
      compactMode: false,
      hideSidebar: false,
      hideHeader: false,
      appName: 'Orthanc Explorer 3',
      logoUrl: `${import.meta.env.BASE_URL}logo/oe3-logo-128.png`,
      dateFormat: 'MMM dd, yyyy',

      setTheme: (theme) => {
        set({ theme });
        const root = document.documentElement;
        if (theme === 'dark') root.classList.add('dark');
        else if (theme === 'light') root.classList.remove('dark');
        else {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          root.classList.toggle('dark', prefersDark);
        }
      },

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setPrimaryColor: (color) => {
        set({ primaryColor: color });
        get().applyTheming();
      },

      setAccentColor: (color) => {
        set({ accentColor: color });
        get().applyTheming();
      },

      setFontPreset: (preset) => {
        set({ fontPreset: preset });
        get().applyTheming();
      },

      setCustomFontStack: (stack) => {
        set({ customFontStack: stack });
        get().applyTheming();
      },

      setBorderRadius: (radius) => {
        set({ borderRadius: radius });
        get().applyTheming();
      },

      setCompactMode: (value) => {
        set({ compactMode: value });
        get().applyTheming();
      },

      setHideSidebar: (value) => set({ hideSidebar: value }),
      setHideHeader: (value) => set({ hideHeader: value }),
      setAppName: (name) => set({ appName: name }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setLogoUrl: (url) => set({ logoUrl: url }),

      resetTheming: () => {
        set({
          primaryColor: DEFAULT_PRIMARY,
          accentColor: DEFAULT_ACCENT,
          fontPreset: 'inter',
          customFontStack: '',
          borderRadius: DEFAULT_RADIUS,
          compactMode: false,
          hideSidebar: false,
          hideHeader: false,
        });
        get().applyTheming();
      },

      applyTheming: () => {
        applyThemeStyles(get());
      },
    }),
    {
      name: 'orthanc-ui',
      partialize: (state) => {
        const { logoUrl, ...rest } = state;
        void logoUrl;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeStyles(state);
        }
      },
    }
  )
);
