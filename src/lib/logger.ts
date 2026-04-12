const ALLOWLIST = new Set([
  "studyId", "seriesId", "instanceId",
  "status", "correlationId", "path", "action",
  "resourceType", "resourceId", "outcome", "errorCode",
  "durationMs", "count",
]);

type Level = "info" | "warn" | "error";
type Event = { level: Level; event: string; fields: Record<string, unknown>; timestamp: string };
type Sink = (e: Event) => void;

let sink: Sink = (e) => {
  // eslint-disable-next-line no-console
  console[e.level === "error" ? "error" : e.level === "warn" ? "warn" : "log"](e);
};

export function __setLoggerSinkForTests(s: Sink): void { sink = s; }

function emit(level: Level, event: string, fields: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (ALLOWLIST.has(k)) safe[k] = v;
  }
  sink({ level, event, fields: safe, timestamp: new Date().toISOString() });
}

export const logger = {
  info: (event: string, fields: Record<string, unknown> = {}) => emit("info", event, fields),
  warn: (event: string, fields: Record<string, unknown> = {}) => emit("warn", event, fields),
  error: (event: string, fields: Record<string, unknown> = {}) => emit("error", event, fields),
};
