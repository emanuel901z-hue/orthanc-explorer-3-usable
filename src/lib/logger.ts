/**
 * PHI-safe structured logger.
 *
 * All log events pass through an explicit allowlist before emission.
 * Only fields in ALLOWLIST may appear in log output — any other field
 * is silently dropped. This is the primary mechanism preventing patient
 * data from entering log infrastructure.
 *
 * Adding a field to ALLOWLIST requires confirming the field cannot carry PHI.
 */

const ALLOWLIST = new Set([
  "studyId", "seriesId", "instanceId",
  "status", "correlationId", "path", "action",
  "resourceType", "resourceId", "outcome", "errorCode",
  "destinationId",
  "durationMs", "count",
]);

type Level = "info" | "warn" | "error";
type Event = { level: Level; event: string; fields: Record<string, unknown>; timestamp: string };
type Sink = (e: Event) => void;

const defaultSink: Sink = (e) => {
  console[e.level === "error" ? "error" : e.level === "warn" ? "warn" : "log"](e);
};
let sink: Sink = defaultSink;

/** @internal — test seam only. Do not call in production code. */
export function __setLoggerSinkForTests(s: Sink): void { sink = s; }
/** @internal — test seam only. Restores the default console sink. */
export function __resetLoggerSinkForTests(): void { sink = defaultSink; }

function emit(level: Level, event: string, fields: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (ALLOWLIST.has(k) && (v === null || typeof v !== "object" && typeof v !== "function")) {
      safe[k] = v;
    }
  }
  sink({ level, event, fields: safe, timestamp: new Date().toISOString() });
}

export const logger = {
  info: (event: string, fields: Record<string, unknown> = {}) => emit("info", event, fields),
  warn: (event: string, fields: Record<string, unknown> = {}) => emit("warn", event, fields),
  error: (event: string, fields: Record<string, unknown> = {}) => emit("error", event, fields),
};
