/**
 * OrthancError — typed error for non-2xx Orthanc HTTP responses.
 *
 * Response bodies are never read into error messages to prevent PHI leakage.
 * User-visible messages are pre-scripted per HTTP status code.
 * The correlationId links UI errors to structured log entries.
 */

const SCRUBBED_MESSAGES: Record<number, string> = {
  400: "The request was invalid.",
  401: "Authentication required.",
  403: "You are not authorized to perform this action.",
  404: "The requested resource was not found.",
  409: "A conflict occurred.",
  500: "The server encountered an error.",
  502: "Upstream service unavailable.",
  503: "Service temporarily unavailable.",
};

export class OrthancError extends Error {
  readonly status: number;
  readonly correlationId: string;

  constructor(status: number, correlationId: string, message: string) {
    super(message);
    this.status = status;
    this.correlationId = correlationId;
    this.name = "OrthancError";
  }

  static async from(res: Response, correlationId: string): Promise<OrthancError> {
    const msg = SCRUBBED_MESSAGES[res.status] ?? `Request failed (${res.status}).`;
    // Intentionally do not read res body into the message — may contain PHI.
    try { await res.text(); } catch { /* ignore */ }
    return new OrthancError(res.status, correlationId, msg);
  }
}
