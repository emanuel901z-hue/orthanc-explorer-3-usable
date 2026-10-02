/**
 * OrthancError — typed error for non-2xx Orthanc HTTP responses.
 *
 * Response bodies are never read into error messages to prevent PHI leakage.
 * User-visible messages are pre-scripted per HTTP status code.
 * The correlationId links UI errors to structured log entries.
 *
 * The pre-scripted texts are **translated here, in one place**: `error.message`
 * is what the operator reads in a toast, an inline alert or a dialog — there are
 * ~60 such call sites, and each of them showed the English text in a German UI.
 * Without an initialised i18n instance (unit tests, log-only paths) the English
 * text stays, so nothing depends on the translation being present.
 */
// the i18next **core**, not the app instance: importing `@/i18n` would pull in
// every locale bundle as a side effect of importing this module
import i18next from 'i18next';

const SCRUBBED_MESSAGES: Record<number, string> = {
  0: 'Network error. Please try again.',
  400: 'The request was invalid.',
  401: 'Authentication required.',
  403: 'You are not authorized to perform this action.',
  404: 'The requested resource was not found.',
  409: 'A conflict occurred.',
  413: 'File too large.',
  500: 'The server encountered an error.',
  502: 'Upstream service unavailable.',
  503: 'Service temporarily unavailable.',
};

/** `status` → the key in the `errors` section, so the texts are translatable. */
const KEY_BY_STATUS: Record<number, string> = {
  0: 'errors.network',
  400: 'errors.http400',
  401: 'errors.http401',
  403: 'errors.http403',
  404: 'errors.http404',
  409: 'errors.http409',
  413: 'errors.http413',
  500: 'errors.http500',
  502: 'errors.http502',
  503: 'errors.http503',
};

export function scrubbedHttpMessage(status: number): string {
  const fallback = SCRUBBED_MESSAGES[status] ?? `Request failed (${status}).`;
  const key = KEY_BY_STATUS[status] ?? 'errors.httpOther';
  // without an initialised i18n (unit tests, log-only paths) the English text
  // stays — nothing depends on the translation being present
  return i18next.isInitialized
    ? i18next.t(key, { status, defaultValue: fallback })
    : fallback;
}

export class OrthancError extends Error {
  readonly status: number;
  readonly correlationId: string;

  constructor(status: number, correlationId: string, message: string) {
    super(message);
    this.status = status;
    this.correlationId = correlationId;
    this.name = 'OrthancError';
  }

  static async from(res: Response, correlationId: string): Promise<OrthancError> {
    const msg = scrubbedHttpMessage(res.status);
    // Intentionally do not read res body into the message — may contain PHI.
    try {
      await res.text();
    } catch {
      /* ignore */
    }
    return new OrthancError(res.status, correlationId, msg);
  }
}

/**
 * Turn any thrown thing into a sentence the operator can read.
 *
 * `OrthancError.message` is already translated (see above); an action's own
 * Error carries whatever it says; anything else gets the generic sentence.
 * The correlation id is appended when there is one — support asks for it, and
 * it is the only way to find the matching log line.
 *
 * `t` comes from the caller's `useTranslation()`, so the helper stays free of
 * the global instance (see the note above).
 */
export function describeError(
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (error instanceof OrthancError) {
    return t('errors.withRef', {
      message: error.message,
      ref: error.correlationId,
      defaultValue: error.message,
    });
  }
  if (error instanceof Error && error.message) return error.message;
  return t('errors.unknown');
}
