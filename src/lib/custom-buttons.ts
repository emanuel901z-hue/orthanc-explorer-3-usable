/**
 * custom-buttons — Configuration for custom HTTP buttons (OE2 "CustomButtons" equivalent).
 *
 * Custom buttons are defined in localStorage (configurable via Settings) and
 * rendered in the Study/Series/Instance detail pages. Each button can:
 *   - Send an HTTP request to a configured URL
 *   - Use template tokens in the URL ({studyId}, {patientId}, {studyInstanceUID}, etc.)
 *   - Open the result in a new tab or show a toast notification
 *
 * Example config:
 * [
 *   {
 *     id: "export-pdf",
 *     label: "Export PDF",
 *     url: "/api/v1/reports/{studyInstanceUID}/pdf",
 *     method: "GET",
 *     target: "tab",
 *     icon: "FileText"
 *   }
 * ]
 */

export type CustomButton = {
  id: string;
  label: string;
  url: string;
  method?: 'GET' | 'POST';
  target?: 'tab' | 'download' | 'toast';
  icon?: string;
  level?: 'study' | 'series' | 'instance';
};

export type ButtonContext = {
  studyId?: string;
  studyInstanceUID?: string;
  patientId?: string;
  patientName?: string;
  accessionNumber?: string;
  seriesId?: string;
  instanceId?: string;
};

const STORAGE_KEY = 'oe3-custom-buttons';

/** Load custom buttons from localStorage. */
export function loadCustomButtons(): CustomButton[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save custom buttons to localStorage. */
export function saveCustomButtons(buttons: CustomButton[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buttons));
}

/** Resolve template tokens in a URL using the button context. */
export function resolveUrl(url: string, ctx: ButtonContext): string {
  return url
    .replace(/\{studyId\}/gi, ctx.studyId || '')
    .replace(/\{studyInstanceUID\}/gi, ctx.studyInstanceUID || '')
    .replace(/\{patientId\}/gi, ctx.patientId || '')
    .replace(/\{patientName\}/gi, encodeURIComponent(ctx.patientName || ''))
    .replace(/\{accessionNumber\}/gi, ctx.accessionNumber || '')
    .replace(/\{seriesId\}/gi, ctx.seriesId || '')
    .replace(/\{instanceId\}/gi, ctx.instanceId || '');
}

/** Execute a custom button action. */
export async function executeButton(button: CustomButton, ctx: ButtonContext): Promise<void> {
  const url = resolveUrl(button.url, ctx);
  const method = button.method || 'GET';

  if (button.target === 'tab') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  if (button.target === 'download') {
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // toast — fetch and show result
  const response = await fetch(url, { method, credentials: 'include' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
