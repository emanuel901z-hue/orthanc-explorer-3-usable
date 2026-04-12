# Orthanc Explorer 3 — v0.1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the existing Lovable-scaffolded SPA to a real local Orthanc stack using a four-layer API architecture with healthcare-grade cross-cutting seams, in three deployment modes from a single build.

**Architecture:** Pure SPA, no backend. Runtime config via `window.__OE3_CONFIG__`. Four layers: `features/*` (UI) → `actions/*` (audit seam) → `api/*` (typed endpoints) → `lib/client.ts` (transport). All cross-cutting concerns (auth, audit, health, errors, correlation) live in `lib/*` as singletons consumed by the client. Reads go `features → api`; writes go `features → actions → api`. Deployment mode is the shape of the runtime config object, never a code branch.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, shadcn/ui, TanStack Query, Zustand, Zod, Vitest + Testing Library, Docker Compose (orthancteam/orthanc:latest-full + rhavekost/orthanc-dicomweb-oauth + rhavekost/azure-dicom-service-emulator).

**Reference design:** [`docs/plans/2026-04-11-initial-architecture-design.md`](./2026-04-11-initial-architecture-design.md)

**Existing scaffolding to preserve (do not delete):**
- `src/config/env.ts`, `src/config/feature-flags.ts` — Lovable-generated; wrap or replace carefully in Task 3.
- `src/features/{studies,series,instances,activity,audit,servers,settings,tasks,upload,viewer}` — Lovable UI shells, currently on mock data.
- `src/store/{ui-store,job-store,tab-store,upload-store,audit-store,activity-ui-store}.ts` — keep UI stores; audit the store list in Task 9 for the `uiStore`/`sessionStore` PHI split.
- `src/test/setup.ts` — Vitest setup lives here.

**Conventions:**
- TDD always: test first (RED), implement (GREEN), commit. No exceptions.
- One task = one logical commit. Conventional commits (`feat:`, `test:`, `chore:`, `refactor:`).
- Use `@/` path alias for all imports under `src/`.
- `bun` is the package manager (see `bun.lockb`). If unavailable, fall back to `npm`. Commands below show `bun`; substitute `npm run` freely.
- Never commit real PHI. Test fixtures only.
- Each task lists **Files** (Create/Modify/Test), numbered **Steps**, and a **Commit** step.

---

## Phase 0 — Local Docker Stack

### Task 0.1: Create docker-compose.dev.yml for local stack

**Files:**
- Create: `docker-compose.dev.yml`
- Create: `docker/oe3-dev.md` (brief usage notes)

**Step 1: Create the compose file**

Paste verbatim (adjust image tags only if Docker Hub names differ):

```yaml
services:
  orthanc:
    image: orthancteam/orthanc:latest-full
    ports:
      - "8042:8042"
      - "4242:4242"
    environment:
      ORTHANC__NAME: "OE3 Dev"
      ORTHANC__REMOTE_ACCESS_ALLOWED: "true"
      ORTHANC__AUTHENTICATION_ENABLED: "false"
      ORTHANC__DICOM_WEB__ENABLE: "true"
      ORTHANC__DICOM_MODALITIES_IN_DATABASE: "true"
      ORTHANC__ORTHANC_PEERS_IN_DATABASE: "true"
      ORTHANC__HTTP_HEADERS: |
        {"Access-Control-Allow-Origin": "*",
         "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
         "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Request-Id"}
    volumes:
      - orthanc-data:/var/lib/orthanc/db

  oauth-plugin:
    image: rhavekost/orthanc-dicomweb-oauth:latest
    environment:
      DICOMWEB_TARGET_URL: "http://azure-emulator:8080/v2"
      OAUTH_TOKEN_ENDPOINT: "http://azure-emulator:8080/oauth/token"
      OAUTH_MODE: "dev"
    depends_on:
      - azure-emulator

  azure-emulator:
    image: rhavekost/azure-dicom-service-emulator:latest
    ports:
      - "8080:8080"
    environment:
      EMULATOR_AUTH_REQUIRED: "false"

volumes:
  orthanc-data:
```

**Step 2: Bring the stack up and verify Orthanc responds**

Run:
```bash
docker compose -f docker-compose.dev.yml up -d
sleep 5
curl -s http://localhost:8042/system | head -30
```

Expected: JSON output with `"Name":"OE3 Dev"` and `"Version"` fields. If this fails, check `docker compose logs orthanc`.

**Step 3: Verify DICOMweb and CORS**

Run:
```bash
curl -s -i http://localhost:8042/dicom-web/studies | head -20
curl -s -i -X OPTIONS http://localhost:8042/studies \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" | head -20
```

Expected: first returns `[]` (empty study list, JSON content type). Second returns `200/204` with `Access-Control-Allow-Origin: *`.

**Step 4: Commit**

```bash
git add docker-compose.dev.yml docker/oe3-dev.md
git commit -m "chore: add local docker-compose dev stack (orthanc + oauth plugin + azure emulator)"
```

---

### Task 0.2: Seed test data profile

**Files:**
- Create: `test-data/README.md` (instructions to drop a public DICOM sample)
- Modify: `docker-compose.dev.yml` (add `seeder` service under `profiles: ["seed"]`)

**Step 1: Download a public DICOM sample**

Use a small pydicom test file. Run:
```bash
mkdir -p test-data
curl -L -o test-data/sample.dcm \
  https://github.com/pydicom/pydicom/raw/main/src/pydicom/data/test_files/CT_small.dcm
ls -lh test-data/sample.dcm
```

Expected: file present, ~40KB.

**Step 2: Add seeder service to docker-compose.dev.yml**

Append:
```yaml
  seeder:
    image: curlimages/curl:latest
    profiles: ["seed"]
    depends_on:
      - orthanc
    command: >
      sh -c "sleep 3 &&
             curl -s -X POST http://orthanc:8042/instances
                  --data-binary @/seed/sample.dcm
                  -H 'Content-Type: application/dicom'"
    volumes:
      - ./test-data:/seed:ro
```

**Step 3: Run seeder and verify study exists**

Run:
```bash
docker compose -f docker-compose.dev.yml --profile seed up seeder
curl -s http://localhost:8042/studies | head
```

Expected: one study UUID in the array.

**Step 4: Document in test-data/README.md**

Write brief instructions (where files come from, how to reseed, that no real PHI is allowed).

**Step 5: Commit**

```bash
git add docker-compose.dev.yml test-data/
git commit -m "chore: add dicom test data seeder profile"
```

---

## Phase 1 — Runtime Config + Feature Resolver

### Task 1.1: Define OE3Config Zod schema with test

**Files:**
- Create: `src/config/runtime.ts`
- Test: `src/config/runtime.test.ts`

**Step 1: Write the failing test**

```ts
// src/config/runtime.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, getConfig, OE3ConfigSchema } from "./runtime";

describe("runtime config", () => {
  afterEach(() => {
    delete (window as any).__OE3_CONFIG__;
  });

  it("parses a valid standalone config", () => {
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: "http://localhost:8042",
      authMode: "none",
      features: {},
    };
    const cfg = loadConfig();
    expect(cfg.orthancUrl).toBe("http://localhost:8042");
    expect(cfg.authMode).toBe("none");
  });

  it("defaults features to empty object", () => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none" };
    const cfg = loadConfig();
    expect(cfg.features).toEqual({});
  });

  it("accepts empty orthancUrl (plugin same-origin mode)", () => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    expect(() => loadConfig()).not.toThrow();
  });

  it("rejects invalid authMode", () => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "bogus", features: {} };
    expect(() => loadConfig()).toThrow();
  });

  it("getConfig throws before loadConfig is called", () => {
    expect(() => getConfig()).toThrow(/loadConfig/);
  });

  it("getConfig returns the loaded config after loadConfig", () => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
    expect(getConfig().authMode).toBe("none");
  });
});
```

**Step 2: Run test to verify failure**

Run: `bun run test src/config/runtime.test.ts`
Expected: all tests FAIL (module not found).

**Step 3: Implement runtime.ts**

```ts
// src/config/runtime.ts
import { z } from "zod";

export const OE3ConfigSchema = z.object({
  orthancUrl: z.string(),
  authMode: z.enum(["none", "basic", "oidc", "smart"]),
  fhir: z.object({
    iss: z.string(),
    clientId: z.string(),
    scope: z.string(),
  }).optional(),
  features: z.record(z.string(), z.boolean()).default({}),
  branding: z.object({
    title: z.string(),
    logoUrl: z.string().optional(),
  }).optional(),
  frameAncestors: z.array(z.string()).optional(),
});

export type OE3Config = z.infer<typeof OE3ConfigSchema>;

let cached: OE3Config | null = null;

export function loadConfig(): OE3Config {
  const raw = (window as unknown as { __OE3_CONFIG__?: unknown }).__OE3_CONFIG__;
  cached = OE3ConfigSchema.parse(raw ?? {});
  return cached;
}

export function getConfig(): OE3Config {
  if (!cached) {
    throw new Error("Config not loaded. Call loadConfig() at app boot.");
  }
  return cached;
}

export function __resetConfigForTests(): void {
  cached = null;
}
```

**Step 4: Run test to verify pass**

Run: `bun run test src/config/runtime.test.ts`
Expected: all 6 tests PASS.

**Step 5: Commit**

```bash
git add src/config/runtime.ts src/config/runtime.test.ts
git commit -m "feat(config): add runtime OE3Config loader with zod validation"
```

---

### Task 1.2: Wire /config.js to public + boot loader

**Files:**
- Create: `public/config.js`
- Modify: `index.html` (add `<script src="/config.js">` before the bundle)
- Modify: `src/main.tsx` (call `loadConfig()` before `createRoot`)

**Step 1: Create dev placeholder config.js**

```js
// public/config.js
window.__OE3_CONFIG__ = {
  orthancUrl: "http://localhost:8042",
  authMode: "none",
  features: {},
  branding: { title: "Orthanc Explorer 3 (Dev)" }
};
```

**Step 2: Add script tag to index.html**

Add **before** the main bundle script in `index.html`:
```html
<script src="/config.js"></script>
```

**Step 3: Call loadConfig in main.tsx**

At the top of `src/main.tsx`, after imports and before the first React render call:
```ts
import { loadConfig } from "@/config/runtime";
loadConfig();
```

If loadConfig throws, wrap in try/catch and render a plain-HTML error screen (`document.body.innerHTML = ...`) so the user sees a diagnostic instead of a white screen.

**Step 4: Verify dev server boots**

Run: `bun run dev`
Open `http://localhost:5173`. Open devtools console. Expected: no errors, `window.__OE3_CONFIG__` populated.

**Step 5: Commit**

```bash
git add public/config.js index.html src/main.tsx
git commit -m "feat(config): load window.__OE3_CONFIG__ at boot via public/config.js"
```

---

### Task 1.3: Layered useFeature resolver

**Files:**
- Create: `src/config/features.ts`
- Test: `src/config/features.test.ts`
- Audit: `src/config/feature-flags.ts` (Lovable file — decide to wrap or replace)

**Step 1: Inspect the existing feature-flags.ts**

Run: `cat src/config/feature-flags.ts`
If it exports a `useFeature` hook already, plan to replace it in Task 1.4. For now create the new resolver alongside.

**Step 2: Write the failing test**

```ts
// src/config/features.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { resolveFeature } from "./features";
import { __resetConfigForTests, loadConfig } from "./runtime";

const setCfg = (features: Record<string, boolean> = {}) => {
  (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features };
  loadConfig();
};

describe("resolveFeature", () => {
  afterEach(() => __resetConfigForTests());

  it("defaults to enabled when no layer objects", () => {
    setCfg();
    expect(resolveFeature("upload", { profile: null, scopes: null })).toBe(true);
  });

  it("returns false when runtime config disables", () => {
    setCfg({ upload: false });
    expect(resolveFeature("upload", { profile: null, scopes: null })).toBe(false);
  });

  it("returns false when profile lacks permission", () => {
    setCfg();
    expect(
      resolveFeature("upload", { profile: { permissions: ["delete"] }, scopes: null })
    ).toBe(false);
  });

  it("returns true when profile has permission", () => {
    setCfg();
    expect(
      resolveFeature("upload", { profile: { permissions: ["upload"] }, scopes: null })
    ).toBe(true);
  });

  it("intersects all layers (AND semantics)", () => {
    setCfg({ upload: true });
    expect(
      resolveFeature("upload", {
        profile: { permissions: ["upload"] },
        scopes: ["patient/ImagingStudy.read"],
      })
    ).toBe(false); // scope doesn't include write
  });
});
```

**Step 3: Run test to verify failure**

Run: `bun run test src/config/features.test.ts`
Expected: FAIL (module not found).

**Step 4: Implement features.ts**

```ts
// src/config/features.ts
import { getConfig } from "./runtime";

export type FeatureKey =
  | "upload" | "delete" | "anonymize" | "modify" | "send"
  | "download" | "editLabels" | "modalityManagement" | "dicomWebManagement";

export type UserProfile = { permissions: string[] } | null;
export type SmartScopes = string[] | null;

type Layers = { profile: UserProfile; scopes: SmartScopes };

const SCOPE_WRITE_FEATURES = new Set<FeatureKey>([
  "upload", "delete", "anonymize", "modify", "send", "editLabels",
]);

function scopeAllows(scopes: string[], key: FeatureKey): boolean {
  const needsWrite = SCOPE_WRITE_FEATURES.has(key);
  return scopes.some((s) =>
    needsWrite ? /ImagingStudy\.(write|\*)/.test(s) : /ImagingStudy\.(read|\*)/.test(s)
  );
}

export function resolveFeature(key: FeatureKey, layers: Layers): boolean {
  const cfg = getConfig();
  if (cfg.features?.[key] === false) return false;
  if (layers.profile && !layers.profile.permissions.includes(key)) return false;
  if (layers.scopes && !scopeAllows(layers.scopes, key)) return false;
  return true;
}
```

**Step 5: Run test to verify pass**

Run: `bun run test src/config/features.test.ts`
Expected: all 5 tests PASS.

**Step 6: Commit**

```bash
git add src/config/features.ts src/config/features.test.ts
git commit -m "feat(config): add layered resolveFeature (runtime + profile + smart scopes)"
```

---

### Task 1.4: useFeature React hook

**Files:**
- Modify: `src/config/features.ts` (add `useFeature` hook)
- Test: `src/config/features.test.tsx`

**Step 1: Write the failing hook test**

```tsx
// src/config/features.test.tsx
import { renderHook } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { useFeature } from "./features";
import { loadConfig, __resetConfigForTests } from "./runtime";

describe("useFeature", () => {
  afterEach(() => __resetConfigForTests());

  it("returns true when no layers restrict", () => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
    const { result } = renderHook(() => useFeature("upload"));
    expect(result.current).toBe(true);
  });

  it("returns false when runtime disables", () => {
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: "", authMode: "none", features: { upload: false },
    };
    loadConfig();
    const { result } = renderHook(() => useFeature("upload"));
    expect(result.current).toBe(false);
  });
});
```

**Step 2: Run to verify failure**

Run: `bun run test src/config/features`
Expected: FAIL (`useFeature` not exported).

**Step 3: Add the hook**

Append to `src/config/features.ts`:
```ts
export function useUserProfile(): UserProfile {
  return null; // Phase 2: fetch from Authorization plugin
}

export function useSmartScopes(): SmartScopes {
  return null; // Phase 2: parse from fhirclient token
}

export function useFeature(key: FeatureKey): boolean {
  const profile = useUserProfile();
  const scopes = useSmartScopes();
  return resolveFeature(key, { profile, scopes });
}
```

**Step 4: Run to verify pass**

Run: `bun run test src/config/features`
Expected: all tests PASS.

**Step 5: Commit**

```bash
git add src/config/features.ts src/config/features.test.tsx
git commit -m "feat(config): add useFeature hook with profile/scope stubs"
```

---

## Phase 2 — Cross-Cutting Seams (stubs)

### Task 2.1: Correlation ID generator

**Files:**
- Create: `src/lib/correlation.ts`
- Test: `src/lib/correlation.test.ts`

**Step 1: Test first**

```ts
import { describe, it, expect } from "vitest";
import { newCorrelationId } from "./correlation";

describe("newCorrelationId", () => {
  it("returns a UUIDv4-shaped string", () => {
    const id = newCorrelationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("returns unique ids across calls", () => {
    expect(newCorrelationId()).not.toBe(newCorrelationId());
  });
});
```

**Step 2: Run — expect FAIL**

Run: `bun run test src/lib/correlation`

**Step 3: Implement**

```ts
// src/lib/correlation.ts
export function newCorrelationId(): string {
  return crypto.randomUUID();
}
```

**Step 4: Run — expect PASS**

**Step 5: Commit**

```bash
git add src/lib/correlation.ts src/lib/correlation.test.ts
git commit -m "feat(lib): add correlation id generator"
```

---

### Task 2.2: PHI-allowlist structured logger

**Files:**
- Create: `src/lib/logger.ts`
- Test: `src/lib/logger.test.ts`

**Step 1: Test first**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger, __setLoggerSinkForTests } from "./logger";

describe("logger", () => {
  const sink = vi.fn();
  beforeEach(() => { sink.mockClear(); __setLoggerSinkForTests(sink); });

  it("emits structured events with allowlisted fields only", () => {
    logger.info("study.viewed", {
      studyId: "orthanc-uuid-123",
      patientName: "REDACT-ME",  // not on allowlist
      correlationId: "abc",
    });
    expect(sink).toHaveBeenCalledOnce();
    const event = sink.mock.calls[0][0];
    expect(event.event).toBe("study.viewed");
    expect(event.fields.studyId).toBe("orthanc-uuid-123");
    expect(event.fields.correlationId).toBe("abc");
    expect(event.fields.patientName).toBeUndefined();
  });

  it("records level", () => {
    logger.error("orthanc.fetch.failed", { status: 500 });
    expect(sink.mock.calls[0][0].level).toBe("error");
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```ts
// src/lib/logger.ts
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
```

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git add src/lib/logger.ts src/lib/logger.test.ts
git commit -m "feat(lib): add PHI-allowlist structured logger"
```

---

### Task 2.3: OrthancError class + error helpers

**Files:**
- Create: `src/lib/errors.ts`
- Test: `src/lib/errors.test.ts`

**Step 1: Test first**

```ts
import { describe, it, expect } from "vitest";
import { OrthancError } from "./errors";

describe("OrthancError", () => {
  it("stores status and correlationId", async () => {
    const res = new Response("Internal boom", { status: 500 });
    const err = await OrthancError.from(res, "corr-1");
    expect(err.status).toBe(500);
    expect(err.correlationId).toBe("corr-1");
    expect(err.message).not.toContain("boom"); // scrubbed display
  });

  it("produces user-friendly messages per status", async () => {
    const err = await OrthancError.from(new Response("", { status: 403 }), "c");
    expect(err.message).toMatch(/not authorized/i);
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```ts
// src/lib/errors.ts
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
```

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git add src/lib/errors.ts src/lib/errors.test.ts
git commit -m "feat(lib): add OrthancError with scrubbed user messages"
```

---

### Task 2.4: Health tracker singleton

**Files:**
- Create: `src/lib/health.ts`
- Test: `src/lib/health.test.ts`

**Step 1: Test first**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { healthTracker } from "./health";

describe("healthTracker", () => {
  beforeEach(() => healthTracker.reset());

  it("starts healthy", () => {
    expect(healthTracker.getState().status).toBe("unknown");
  });
  it("becomes degraded after consecutive failures", () => {
    healthTracker.recordFailure();
    healthTracker.recordFailure();
    healthTracker.recordFailure();
    expect(healthTracker.getState().status).toBe("degraded");
  });
  it("returns to healthy after a success", () => {
    healthTracker.recordFailure();
    healthTracker.recordFailure();
    healthTracker.recordFailure();
    healthTracker.record(true, 200);
    expect(healthTracker.getState().status).toBe("healthy");
  });
  it("notifies subscribers on state change", () => {
    const states: string[] = [];
    const unsub = healthTracker.subscribe((s) => states.push(s.status));
    healthTracker.recordFailure(); healthTracker.recordFailure(); healthTracker.recordFailure();
    unsub();
    expect(states).toContain("degraded");
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```ts
// src/lib/health.ts
type Status = "unknown" | "healthy" | "degraded";
type State = { status: Status; consecutiveFailures: number };
type Listener = (s: State) => void;

const FAILURE_THRESHOLD = 3;
let state: State = { status: "unknown", consecutiveFailures: 0 };
const listeners = new Set<Listener>();

function setState(next: State) {
  state = next;
  listeners.forEach((l) => l(state));
}

export const healthTracker = {
  record(ok: boolean, _status: number): void {
    if (ok) setState({ status: "healthy", consecutiveFailures: 0 });
    else this.recordFailure();
  },
  recordFailure(): void {
    const n = state.consecutiveFailures + 1;
    setState({
      status: n >= FAILURE_THRESHOLD ? "degraded" : state.status,
      consecutiveFailures: n,
    });
  },
  getState(): State { return state; },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  reset(): void {
    state = { status: "unknown", consecutiveFailures: 0 };
    listeners.clear();
  },
};
```

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git add src/lib/health.ts src/lib/health.test.ts
git commit -m "feat(lib): add healthTracker with subscriber pattern"
```

---

### Task 2.5: Audit client stub

**Files:**
- Create: `src/lib/audit.ts`
- Test: `src/lib/audit.test.ts`

**Step 1: Test first**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auditClient } from "./audit";
import { __setLoggerSinkForTests } from "./logger";

describe("auditClient", () => {
  const sink = vi.fn();
  beforeEach(() => { sink.mockClear(); __setLoggerSinkForTests(sink); });

  it("emits audit events via the logger", () => {
    auditClient.emit({
      action: "study.delete",
      resourceType: "study",
      resourceId: "abc-123",
      outcome: "success",
      timestamp: "2026-04-11T00:00:00Z",
    });
    expect(sink).toHaveBeenCalledOnce();
    const event = sink.mock.calls[0][0];
    expect(event.event).toBe("audit");
    expect(event.fields.action).toBe("study.delete");
    expect(event.fields.outcome).toBe("success");
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```ts
// src/lib/audit.ts
import { logger } from "./logger";

export type AuditEvent = {
  action: string;
  resourceType: "study" | "series" | "instance" | "modality" | "dicomWebServer" | "peer";
  resourceId: string;
  outcome: "success" | "failure";
  timestamp: string;
  errorCode?: number;
  reason?: string;
};

export const auditClient = {
  emit(event: AuditEvent): void {
    logger.info("audit", {
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      outcome: event.outcome,
      errorCode: event.errorCode,
    });
    // Phase 2: POST to /audit/events when ATNA plugin is installed.
  },
};
```

**Add `action`, `outcome` to logger allowlist** in `src/lib/logger.ts` (they're already present — verify).

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git add src/lib/audit.ts src/lib/audit.test.ts
git commit -m "feat(lib): add auditClient stub (logs via logger, ATNA-ready)"
```

---

## Phase 3 — Transport Layer (`lib/client.ts`)

### Task 3.1: orthancFetch with auth headers + correlation + health

**Files:**
- Create: `src/lib/client.ts`
- Test: `src/lib/client.test.ts`

**Step 1: Test first**

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { orthancFetch } from "./client";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";
import { healthTracker } from "./health";
import { OrthancError } from "./errors";

const setCfg = () => {
  (window as any).__OE3_CONFIG__ = {
    orthancUrl: "http://localhost:8042", authMode: "none", features: {},
  };
  loadConfig();
};

describe("orthancFetch", () => {
  beforeEach(() => { setCfg(); healthTracker.reset(); });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("prepends orthancUrl and attaches correlation id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await orthancFetch("/system");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8042/system");
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("parses JSON response bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ name: "OE3" }), { status: 200 }),
    );
    const data = await orthancFetch<{ name: string }>("/system");
    expect(data.name).toBe("OE3");
  });

  it("returns undefined on 204 No Content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const data = await orthancFetch<void>("/studies/abc", { method: "DELETE" });
    expect(data).toBeUndefined();
  });

  it("throws OrthancError on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(orthancFetch("/system")).rejects.toBeInstanceOf(OrthancError);
  });

  it("records health on success and failure", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("", { status: 500 }));
    await orthancFetch("/system");
    await orthancFetch("/system").catch(() => {});
    await orthancFetch("/system").catch(() => {});
    await orthancFetch("/system").catch(() => {});
    expect(healthTracker.getState().status).toBe("degraded");
  });

  it("uses empty base for same-origin plugin mode", async () => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await orthancFetch("/system");
    expect(fetchMock.mock.calls[0][0]).toBe("/system");
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```ts
// src/lib/client.ts
import { getConfig, type OE3Config } from "@/config/runtime";
import { newCorrelationId } from "./correlation";
import { healthTracker } from "./health";
import { OrthancError } from "./errors";
import { logger } from "./logger";

async function attachAuthHeaders(headers: Headers, cfg: OE3Config): Promise<void> {
  switch (cfg.authMode) {
    case "none": return;
    case "basic": {
      // Dev/simple deployments — browser credential prompt or env injection.
      // Real implementation added when basic-auth deployment is exercised.
      return;
    }
    case "oidc":
    case "smart": {
      // Phase 2: pull bearer token from fhirclient / oidc-client-ts.
      return;
    }
  }
}

export async function orthancFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const cfg = getConfig();
  const correlationId = newCorrelationId();
  const url = cfg.orthancUrl ? `${cfg.orthancUrl}${path}` : path;

  const headers = new Headers(init.headers);
  headers.set("X-Request-Id", correlationId);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  await attachAuthHeaders(headers, cfg);

  try {
    const res = await fetch(url, { ...init, headers, credentials: "include" });
    healthTracker.record(res.ok, res.status);
    if (!res.ok) {
      const err = await OrthancError.from(res, correlationId);
      logger.error("orthanc.fetch.failed", {
        path, status: err.status, correlationId,
      });
      throw err;
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (e) {
    if (!(e instanceof OrthancError)) {
      healthTracker.recordFailure();
      logger.error("orthanc.fetch.failed", { path, correlationId });
    }
    throw e;
  }
}
```

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git add src/lib/client.ts src/lib/client.test.ts
git commit -m "feat(lib): add orthancFetch transport with auth/correlation/health/errors"
```

---

## Phase 4 — Typed API Modules (`api/*`)

### Task 4.1: api/system.ts — smallest read path end-to-end

**Files:**
- Create: `src/api/system.ts`
- Test: `src/api/system.test.ts`

**Step 1: Test first**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { systemApi } from "./system";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("systemApi", () => {
  beforeEach(() => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("get() hits /system", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ Name: "OE3 Dev", Version: "1.12.4" }), { status: 200 }),
    );
    const data = await systemApi.get();
    expect(data.Name).toBe("OE3 Dev");
    expect(fetchMock.mock.calls[0][0]).toBe("/system");
  });

  it("stats() hits /statistics", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ CountStudies: 5 }), { status: 200 }),
    );
    await systemApi.stats();
    expect(fetchMock.mock.calls[0][0]).toBe("/statistics");
  });

  it("plugins() hits /plugins", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(["dicom-web"]), { status: 200 }),
    );
    const list = await systemApi.plugins();
    expect(list).toEqual(["dicom-web"]);
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```ts
// src/api/system.ts
import { orthancFetch } from "@/lib/client";

export type OrthancSystem = {
  Name: string;
  Version: string;
  ApiVersion: number;
  DatabaseVersion: number;
  DicomAet: string;
  DicomPort: number;
  HttpPort: number;
  PluginsEnabled: boolean;
};

export type OrthancStats = {
  CountPatients: number;
  CountStudies: number;
  CountSeries: number;
  CountInstances: number;
  TotalDiskSize: string;
};

export const systemApi = {
  get: () => orthancFetch<OrthancSystem>("/system"),
  stats: () => orthancFetch<OrthancStats>("/statistics"),
  plugins: () => orthancFetch<string[]>("/plugins"),
};
```

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git add src/api/system.ts src/api/system.test.ts
git commit -m "feat(api): add typed system/statistics/plugins endpoint module"
```

---

### Task 4.2: api/studies.ts

**Files:**
- Create: `src/api/studies.ts`
- Test: `src/api/studies.test.ts`

**Step 1: Test first**

Cover: `find()` is POST to `/tools/find` with JSON body (enforces PHI-not-in-URL rule); `get(id)` hits `/studies/{id}`; `getSeries(id)` hits `/studies/{id}/series`; `delete(id)` is DELETE.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { studiesApi } from "./studies";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

describe("studiesApi", () => {
  beforeEach(() => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });
  afterEach(() => { __resetConfigForTests(); vi.restoreAllMocks(); });

  it("find() POSTs /tools/find (PHI not in URL)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await studiesApi.find({ Level: "Study", Query: { PatientName: "Doe^Jane" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/tools/find");
    expect((init as RequestInit).method).toBe("POST");
    expect(url).not.toContain("Doe");  // PHI must not be in URL
    expect(JSON.parse((init as RequestInit).body as string).Query.PatientName).toBe("Doe^Jane");
  });

  it("get() hits /studies/:id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await studiesApi.get("abc-123");
    expect(fetchMock.mock.calls[0][0]).toBe("/studies/abc-123");
  });

  it("getSeries() hits /studies/:id/series", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    await studiesApi.getSeries("abc-123");
    expect(fetchMock.mock.calls[0][0]).toBe("/studies/abc-123/series");
  });

  it("delete() uses DELETE method", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    await studiesApi.delete("abc-123");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```ts
// src/api/studies.ts
import { orthancFetch } from "@/lib/client";

export type OrthancFindQuery = {
  Level: "Patient" | "Study" | "Series" | "Instance";
  Query: Record<string, string>;
  Limit?: number;
  Since?: number;
  Expand?: boolean;
};

export type Study = {
  ID: string;
  MainDicomTags: Record<string, string>;
  PatientMainDicomTags: Record<string, string>;
  ParentPatient: string;
  Series: string[];
  Type: "Study";
};

export type Series = {
  ID: string;
  MainDicomTags: Record<string, string>;
  ParentStudy: string;
  Instances: string[];
  Type: "Series";
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export const studiesApi = {
  find: (query: OrthancFindQuery) =>
    orthancFetch<Study[]>("/tools/find", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(query),
    }),

  get: (id: string) => orthancFetch<Study>(`/studies/${id}`),

  getSeries: (id: string) => orthancFetch<Series[]>(`/studies/${id}/series`),

  delete: (id: string) =>
    orthancFetch<void>(`/studies/${id}`, { method: "DELETE" }),

  anonymize: (id: string, body: Record<string, unknown> = {}) =>
    orthancFetch<{ ID: string; Path: string }>(`/studies/${id}/anonymize`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),

  modify: (id: string, body: Record<string, unknown>) =>
    orthancFetch<{ ID: string; Path: string }>(`/studies/${id}/modify`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }),
};
```

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git add src/api/studies.ts src/api/studies.test.ts
git commit -m "feat(api): add typed studies endpoint module"
```

---

### Task 4.3: Remaining API modules

Implement each with the same TDD pattern (test file + module). Keep tests small: one test per method verifying URL + method + (for PHI searches) POST body not query string.

Create all of the following. Commit after each module passes.

**4.3a `src/api/series.ts`** — `get(id)`, `getInstances(id)`, `delete(id)`
**4.3b `src/api/instances.ts`** — `get(id)`, `getTags(id)`, `getPreview(id)` (returns `Blob`), `delete(id)`, `upload(file: File)` POSTing to `/instances` with `application/dicom`
**4.3c `src/api/modalities.ts`** — `list()`, `get(name)`, `put(name, body)`, `delete(name)`, `echo(name)` → `POST /modalities/{name}/echo`
**4.3d `src/api/peers.ts`** — `list()`, `put(name, body)`, `delete(name)`
**4.3e `src/api/dicomWebServers.ts`** — `list()`, `put(name, body)`, `delete(name)`
**4.3f `src/api/jobs.ts`** — `list()`, `get(id)`, `cancel(id)`
**4.3g `src/api/changes.ts`** — `list({ since, limit })` → `GET /changes?since=...&limit=...`
**4.3h `src/api/tools.ts`** — `lookup(body)` → `POST /tools/lookup`

For each module:
1. Write tests first.
2. Run — FAIL.
3. Implement.
4. Run — PASS.
5. `git commit -m "feat(api): add typed <name> endpoint module"`

Instance upload deserves special care — the body is the raw `File`, not JSON:

```ts
// src/api/instances.ts (excerpt)
upload: (file: File | Blob) =>
  orthancFetch<{ ID: string; Status: string }>("/instances", {
    method: "POST",
    headers: { "Content-Type": "application/dicom" },
    body: file,
  }),
```

---

## Phase 5 — Actions Layer (audit seam)

### Task 5.1: deleteStudyAction

**Files:**
- Create: `src/actions/deleteStudy.ts`
- Test: `src/actions/deleteStudy.test.ts`

**Step 1: Test first**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteStudyAction } from "./deleteStudy";
import { studiesApi } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

describe("deleteStudyAction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls studiesApi.delete and emits success audit", async () => {
    const apiSpy = vi.spyOn(studiesApi, "delete").mockResolvedValue(undefined);
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    await deleteStudyAction({ ID: "abc", MainDicomTags: {}, PatientMainDicomTags: {}, ParentPatient: "", Series: [], Type: "Study" });
    expect(apiSpy).toHaveBeenCalledWith("abc");
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: "study.delete",
      resourceId: "abc",
      outcome: "success",
    }));
  });

  it("emits failure audit and rethrows on error", async () => {
    vi.spyOn(studiesApi, "delete").mockRejectedValue(new OrthancError(500, "c", "boom"));
    const auditSpy = vi.spyOn(auditClient, "emit").mockImplementation(() => {});
    await expect(deleteStudyAction({ ID: "abc" } as any)).rejects.toBeInstanceOf(OrthancError);
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "failure",
      errorCode: 500,
    }));
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```ts
// src/actions/deleteStudy.ts
import { studiesApi, type Study } from "@/api/studies";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";

export async function deleteStudyAction(study: Study, reason?: string): Promise<void> {
  const base = {
    action: "study.delete",
    resourceType: "study" as const,
    resourceId: study.ID,
    timestamp: new Date().toISOString(),
    reason,
  };
  try {
    await studiesApi.delete(study.ID);
    auditClient.emit({ ...base, outcome: "success" });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: "failure",
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
```

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git add src/actions/deleteStudy.ts src/actions/deleteStudy.test.ts
git commit -m "feat(actions): add deleteStudyAction with audit seam"
```

---

### Task 5.2: Remaining actions

Use the **same TDD pattern** as 5.1 for each. Each commits separately.

**5.2a `anonymizeStudyAction`** → `studiesApi.anonymize(id, body)`; action `"study.anonymize"`
**5.2b `modifyStudyAction`** → `studiesApi.modify(id, body)`; action `"study.modify"`
**5.2c `uploadInstancesAction(files: File[])`** — iterates files, calls `instancesApi.upload`, reports per-file success/failure, emits one audit per file. Action `"instance.upload"`.
**5.2d `sendStudyAction(studyId, targetKind, targetName)`** — POSTs to `/modalities/{target}/store` or `/peers/{target}/store` with `[studyId]` body. Action `"study.send"`.
**5.2e `downloadStudyAction(studyId)`** — calls a new `studiesApi.archive(id)` that fetches `/studies/{id}/archive` as a `Blob` and triggers browser download via `URL.createObjectURL`. Action `"study.download"`.

For 5.2e you'll need to add `archive` to `studiesApi` first (TDD: new test for the API, then the method). That's one additional small commit before the action.

---

## Phase 6 — Wire Features to Real API

Replace mock data in the existing Lovable features with real hooks. **Do not rewrite the UI components** — just swap data sources.

### Task 6.1: studies list feature uses real API

**Files:**
- Audit: `src/features/studies/` (find the file rendering the study table)
- Create: `src/features/studies/hooks/useStudies.ts`
- Create: `src/features/studies/hooks/useStudies.test.ts`
- Modify: the list component to call `useStudies` instead of reading mock data

**Step 1: Inspect existing feature**

Run: `ls src/features/studies/`
Open the main list component. Identify where mock data is imported.

**Step 2: Write hook test**

```tsx
// src/features/studies/hooks/useStudies.test.tsx
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStudies } from "./useStudies";
import { studiesApi } from "@/api/studies";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("useStudies", () => {
  beforeEach(() => {
    (window as any).__OE3_CONFIG__ = { orthancUrl: "", authMode: "none", features: {} };
    loadConfig();
  });

  it("fetches studies via studiesApi.find", async () => {
    const spy = vi.spyOn(studiesApi, "find").mockResolvedValue([
      { ID: "abc", MainDicomTags: {}, PatientMainDicomTags: {}, ParentPatient: "", Series: [], Type: "Study" },
    ]);
    const { result } = renderHook(() => useStudies({ Level: "Study", Query: {} }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
  });
});
```

**Step 3: Run — FAIL**

**Step 4: Implement**

```ts
// src/features/studies/hooks/useStudies.ts
import { useQuery } from "@tanstack/react-query";
import { studiesApi, type OrthancFindQuery } from "@/api/studies";

export function useStudies(query: OrthancFindQuery) {
  return useQuery({
    queryKey: ["studies", query],
    queryFn: () => studiesApi.find(query),
  });
}
```

**Step 5: Run — PASS**

**Step 6: Swap the component's data source**

Edit the study list component to call `useStudies(...)` and render `data ?? []`. Replace any `mockStudies` import.

**Step 7: Manual verification**

Ensure the docker compose stack is up and seeded. Run `bun run dev`, load the app, verify the study list shows the seeded sample.

**Step 8: Commit**

```bash
git add src/features/studies/hooks/useStudies.ts src/features/studies/hooks/useStudies.test.tsx src/features/studies/<modified-component>.tsx
git commit -m "feat(studies): wire study list to real Orthanc /tools/find"
```

---

### Task 6.2: study detail feature uses real API

Pattern is identical. Create `useStudy(id)` and `useSeries(studyId)` hooks, write tests, swap the component. Commit as `feat(studies): wire study detail and series list to real Orthanc`.

---

### Task 6.3: upload feature uses uploadInstancesAction

Replace the upload page's submit handler with one that calls `uploadInstancesAction`. Show per-file progress driven by the action's per-file callback. Test the handler with a mocked `instancesApi.upload`. Commit as `feat(upload): wire drag-drop upload to real Orthanc`.

---

### Task 6.4: activity timeline uses /changes

Poll `/changes?since=N&limit=100` on an interval (React Query `refetchInterval: 5000`). Maintain `since` cursor in component state. Test the hook with mocked `changesApi.list`. Commit as `feat(activity): wire timeline to /changes polling`.

---

### Task 6.5: job manager uses /jobs

Similar polling pattern against `jobsApi.list()`. Commit as `feat(jobs): wire job manager to /jobs polling`.

---

### Task 6.6: settings — modalities CRUD + C-Echo

Wire the modalities settings page to `modalitiesApi`. Add a C-Echo button per row that calls `modalitiesApi.echo(name)` and shows a toast with result. Tests for hooks only. Commit as `feat(settings): wire modalities management to real Orthanc`.

---

### Task 6.7: settings — dicomWeb servers CRUD

Same pattern. Commit as `feat(settings): wire dicomWeb servers management to real Orthanc`.

---

### Task 6.8: settings — system info read-only

`useSystem()`, `useStats()`, `usePlugins()` hooks, render in the system tab. Commit as `feat(settings): wire system info to /system /statistics /plugins`.

---

### Task 6.9: wire destructive study actions

Hook up the existing "Delete", "Anonymize", "Modify", "Send", "Download" buttons on the study detail screen to their respective actions from Phase 5. Each button already exists in the Lovable scaffolding — just wire its `onClick`. Use `useMutation` from TanStack Query wrapping the action function, with `onSuccess: () => queryClient.invalidateQueries(...)`. Commit as `feat(studies): wire destructive actions via actions/ audit seam`.

---

## Phase 7 — Store Split (PHI hygiene)

### Task 7.1: Audit existing stores for PHI

**Files:**
- Inspect: `src/store/*.ts`

**Step 1: Read each store file**

Run: `cat src/store/*.ts | head -500`

Classify each store: **UI (persistable, no PHI)** or **session (memory-only)**. Document findings in a comment at the top of each file.

**Step 2: Create `src/store/sessionStore.ts`** for anything that currently holds (or could hold) PHI — selected study IDs, active filter state, open tabs.

**Step 3: Ensure no store calls `persist(...)` middleware on PHI-carrying fields.**

**Step 4: Add a test**

```ts
// src/store/sessionStore.test.ts
import { describe, it, expect } from "vitest";
import { useSessionStore } from "./sessionStore";

describe("sessionStore", () => {
  it("does not persist to localStorage", () => {
    useSessionStore.getState().setCurrentStudyId("abc");
    expect(localStorage.getItem("oe3-session")).toBeNull();
  });
});
```

**Step 5: Run — PASS (after creating sessionStore without persist middleware)**

**Step 6: Commit**

```bash
git add src/store/sessionStore.ts src/store/sessionStore.test.ts
git commit -m "feat(store): add memory-only sessionStore for PHI-carrying state"
```

---

## Phase 8 — Global UX Seams (boot integration)

### Task 8.1: Global health banner

**Files:**
- Create: `src/components/HealthBanner.tsx`
- Test: `src/components/HealthBanner.test.tsx`
- Modify: `src/App.tsx` to render `<HealthBanner />` at the top

**Step 1: Test**

```tsx
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { HealthBanner } from "./HealthBanner";
import { healthTracker } from "@/lib/health";

describe("HealthBanner", () => {
  beforeEach(() => healthTracker.reset());
  it("hides when healthy/unknown", () => {
    render(<HealthBanner />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("shows when degraded", () => {
    render(<HealthBanner />);
    act(() => {
      healthTracker.recordFailure();
      healthTracker.recordFailure();
      healthTracker.recordFailure();
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```tsx
// src/components/HealthBanner.tsx
import { useEffect, useState } from "react";
import { healthTracker } from "@/lib/health";

export function HealthBanner() {
  const [status, setStatus] = useState(healthTracker.getState().status);
  useEffect(() => healthTracker.subscribe((s) => setStatus(s.status)), []);
  if (status !== "degraded") return null;
  return (
    <div role="alert" className="bg-destructive text-destructive-foreground px-4 py-2 text-sm">
      Connection to Orthanc is degraded. Data may be stale.
    </div>
  );
}
```

**Step 4: Mount in App.tsx** (top of layout).

**Step 5: Run — PASS**

**Step 6: Commit**

```bash
git add src/components/HealthBanner.tsx src/components/HealthBanner.test.tsx src/App.tsx
git commit -m "feat(ux): global health banner subscribed to healthTracker"
```

---

### Task 8.2: Error boundary with scrubbed display

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/App.tsx` to wrap the router in the boundary

**Step 1: Implement a class error boundary** that renders a fallback showing `OrthancError.message` (already scrubbed) and `correlationId` (for support), and calls `logger.error("ui.error", { correlationId, status })` in `componentDidCatch`.

**Step 2: Wrap `<RouterProvider>` (or equivalent) in the boundary.**

**Step 3: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/App.tsx
git commit -m "feat(ux): add error boundary with PHI-safe error display"
```

---

## Phase 9 — End-to-End Smoke Test

### Task 9.1: Manual smoke checklist

**Files:**
- Create: `docs/plans/2026-04-11-v0.1-smoke-checklist.md`

**Contents:**

A markdown checklist covering, in order, against the live docker compose stack:

1. `docker compose -f docker-compose.dev.yml up -d` — verify all three containers healthy.
2. Seed profile uploads sample study.
3. `bun run dev` — app loads without console errors.
4. `window.__OE3_CONFIG__` populated; Zod validation did not fail.
5. Study list shows at least one study.
6. Clicking a study opens the detail view with real series data.
7. Upload page accepts a drag-drop of `test-data/sample.dcm` and reports success.
8. Activity timeline shows events for recent operations.
9. Settings → Modalities: add a dummy modality, C-Echo button returns a (expected) failure toast, delete removes it.
10. Settings → System: shows `OE3 Dev` name and plugin list.
11. Delete study action: confirm audit log entry in dev console (`event: "audit"`, `action: "study.delete"`, `outcome: "success"`).
12. Stop the Orthanc container. Within ~5s, the global health banner should appear.
13. Restart Orthanc. Banner should disappear on next successful poll.

**Step 2: Walk the checklist manually.** Fix any failures by opening new tasks — do not silently ignore.

**Step 3: Commit**

```bash
git add docs/plans/2026-04-11-v0.1-smoke-checklist.md
git commit -m "docs: add v0.1 end-to-end smoke checklist"
```

---

## Phase 10 — Finalize

### Task 10.1: Full test + lint pass

**Step 1:** `bun run test` — all green.
**Step 2:** `bun run lint` — no errors.
**Step 3:** `bun run build` — production build succeeds.
**Step 4:** If any fail, open follow-up tasks. Do not paper over.

### Task 10.2: Update README

**Files:**
- Modify: `README.md`

Add a "Development" section: docker compose up, seed, `bun run dev`, the smoke checklist location, and a link to the design doc.

**Commit:** `docs: update README with v0.1 development instructions`.

### Task 10.3: Tag v0.1.0

Only after smoke checklist fully green:

```bash
git tag -a v0.1.0 -m "v0.1.0: architecture foundation + real Orthanc integration"
```

---

## Done Criteria

- All 10 phases committed, tests green, lint clean, prod build succeeds.
- Smoke checklist walked end-to-end against the live docker compose stack with zero unresolved failures.
- Every mutation on a study routes through `actions/*` (grep confirms no component imports `studiesApi.delete` / `anonymize` / `modify` / `send` directly).
- Every `fetch` call in `src/` is inside `lib/client.ts` (grep: `rg "fetch\(" src/ --type ts` returns only `lib/client.ts` and tests).
- `getConfig()` is the single source of truth for deployment mode; no component branches on `authMode`.

## Open Questions Parked for Post-v0.1

Carry these from the design doc as tracking issues, not blockers:

1. Verify OAuth plugin dev-mode token shape against the sibling repo's `OAUTH_MODE=dev` code path.
2. Pick the canonical public DICOM sample set (Visible Human vs pydicom test files) and document in `test-data/README.md`.
3. Nginx CSP header + meta tag fallback — wire in the production Dockerfile phase.
4. `fhirclient` library fit for SMART launch — sanity-check before Phase 2 begins.
