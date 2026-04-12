/**
 * Returns a new UUIDv4 string suitable for use as an X-Request-Id header value.
 */
export function newCorrelationId(): string {
  return crypto.randomUUID();
}
