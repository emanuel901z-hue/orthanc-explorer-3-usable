# Code Review Remediation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve all Critical, Important, and Minor findings from the 2026-04-12 code review to bring the codebase to production-ready healthcare quality.

**Architecture:** Audit gaps are the top priority (PHI compliance risk). Progress bar and accessibility fixes come next. Minor cleanup tasks are batched at the end. All changes follow TDD: write the failing test first, implement to pass, commit.

**Tech Stack:** TypeScript 5.8, React 18, Vitest + RTL, Playwright, Zustand, TanStack Query, shadcn/ui, Tailwind CSS

---

## Phase 1 — Critical: Audit Gaps

### Task 1: Extract shared `makeAuditBase` helper (prerequisite for Tasks 2–4)

> Context: `saveModality.ts`, `deleteModality.ts`, and `echoModality.ts` all duplicate the same `{ action, resourceType, resourceId, timestamp }` object literal. We extract this once, then use it in all four new actions (Tasks 2–4).

**Files:**

- Create: `src/actions/audit-base.ts`
- Create: `src/actions/audit-base.test.ts`
- Modify: `src/actions/saveModality.ts`
- Modify: `src/actions/deleteModality.ts`
- Modify: `src/actions/echoModality.ts`

**Step 1: Write the failing test**

Create `src/actions/audit-base.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeAuditBase } from './audit-base';

describe('makeAuditBase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('returns base audit object with ISO timestamp', () => {
    const base = makeAuditBase('study.send', 'study', 'abc123');
    expect(base).toEqual({
      action: 'study.send',
      resourceType: 'study',
      resourceId: 'abc123',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('resourceType is typed as const', () => {
    // TypeScript compile-time assertion: this should not produce a type error
    const base = makeAuditBase('study.label.add', 'study', 'xyz');
    expect(base.resourceType).toBe('study');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/actions/audit-base.test.ts
```

Expected: FAIL — "Cannot find module './audit-base'"

**Step 3: Create `src/actions/audit-base.ts`**

```typescript
import type { AuditEvent } from '@/lib/audit';

/**
 * Builds the common audit event base object.
 * Extracted to eliminate duplication across action files.
 */
export function makeAuditBase(
  action: string,
  resourceType: AuditEvent['resourceType'],
  resourceId: string,
): Omit<AuditEvent, 'outcome' | 'errorCode' | 'reason'> {
  return {
    action,
    resourceType,
    resourceId,
    timestamp: new Date().toISOString(),
  };
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/actions/audit-base.test.ts
```

Expected: PASS

**Step 5: Update the three existing action files to use `makeAuditBase`**

In `src/actions/saveModality.ts`, replace:

```typescript
import { modalitiesApi, type ModalityConfig } from "@/api/modalities";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
```

with:

```typescript
import { modalitiesApi, type ModalityConfig } from "@/api/modalities";
import { auditClient } from "@/lib/audit";
import { OrthancError } from "@/lib/errors";
import { makeAuditBase } from "@/actions/audit-base";
```

And replace the `const base = { ... }` block with:

```typescript
const base = makeAuditBase('modality.save', 'modality', name);
```

Apply the same pattern to `deleteModality.ts` (action: `'modality.delete'`) and `echoModality.ts` (action: `'modality.echo'`).

**Step 6: Run existing action tests to confirm nothing regressed**

```bash
npx vitest run src/actions/
```

Expected: all PASS

**Step 7: Commit**

```bash
git add src/actions/audit-base.ts src/actions/audit-base.test.ts \
        src/actions/saveModality.ts src/actions/deleteModality.ts \
        src/actions/echoModality.ts
git commit -m "refactor: extract makeAuditBase helper, eliminate audit object duplication"
```

---

### Task 2: Add audit coverage for `sendToModality`

> Context: `OrthancStudyRepository.sendToModality()` (line 260 of `src/shared/api/orthanc-study-repository.ts`) calls `orthancFetch` directly, bypassing the `actions/` audit seam. Sending a study to a modality is a PHI-affecting write that must be audited.

**Files:**

- Create: `src/actions/sendStudy.ts`
- Create: `src/actions/sendStudy.test.ts`
- Modify: `src/shared/api/orthanc-study-repository.ts` (lines 260–268)

**Step 1: Write the failing test**

Create `src/actions/sendStudy.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/studies', () => ({
  studiesApi: {
    sendToModality: vi.fn(),
  },
}));
vi.mock('@/lib/audit', () => ({
  auditClient: { emit: vi.fn() },
}));

import { sendStudyAction } from './sendStudy';
import { studiesApi } from '@/api/studies';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';

describe('sendStudyAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('calls studiesApi.sendToModality and emits success audit event', async () => {
    vi.mocked(studiesApi.sendToModality).mockResolvedValue(undefined);

    await sendStudyAction('study-abc', 'PACS_PRIMARY');

    expect(studiesApi.sendToModality).toHaveBeenCalledWith('study-abc', 'PACS_PRIMARY');
    expect(auditClient.emit).toHaveBeenCalledWith({
      action: 'study.send',
      resourceType: 'study',
      resourceId: 'study-abc',
      outcome: 'success',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('emits failure audit event and rethrows on error', async () => {
    const err = new OrthancError(503, 'unavailable');
    vi.mocked(studiesApi.sendToModality).mockRejectedValue(err);

    await expect(sendStudyAction('study-abc', 'PACS_PRIMARY')).rejects.toBe(err);
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', errorCode: 503 }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/actions/sendStudy.test.ts
```

Expected: FAIL — "Cannot find module './sendStudy'"

**Step 3: Add `sendToModality` to `studiesApi` in `src/api/studies.ts`**

Look at the existing `studiesApi` object and append:

```typescript
sendToModality: (studyId: string, modalityId: string) =>
  orthancFetch<void>(`/modalities/${encodeURIComponent(modalityId)}/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Resources: [studyId] }),
  }),
```

**Step 4: Create `src/actions/sendStudy.ts`**

```typescript
/**
 * sendStudyAction — audit-seam wrapper for sending a study to a DICOM modality.
 *
 * Side effects:
 *   1. Calls studiesApi.sendToModality(studyId, modalityId) — POSTs to
 *      /modalities/{name}/store.
 *   2. Emits an audit event (outcome: success | failure) via auditClient.
 *   3. Always rethrows on failure — callers must handle OrthancError.
 */
import { studiesApi } from '@/api/studies';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function sendStudyAction(
  studyId: string,
  modalityId: string,
): Promise<void> {
  const base = makeAuditBase('study.send', 'study', studyId);
  try {
    await studiesApi.sendToModality(studyId, modalityId);
    auditClient.emit({ ...base, outcome: 'success' });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run src/actions/sendStudy.test.ts
```

Expected: PASS

**Step 6: Update `OrthancStudyRepository.sendToModality` to call the action**

In `src/shared/api/orthanc-study-repository.ts`, replace the `sendToModality` method body:

Old:

```typescript
async sendToModality(id: string, modalityId: string): Promise<void> {
  await orthancFetch<unknown>(`/modalities/${modalityId}/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Resources: [id] }),
  });
}
```

New:

```typescript
async sendToModality(id: string, modalityId: string): Promise<void> {
  await sendStudyAction(id, modalityId);
}
```

Add import at top: `import { sendStudyAction } from '@/actions/sendStudy';`

**Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: all PASS

**Step 8: Commit**

```bash
git add src/actions/sendStudy.ts src/actions/sendStudy.test.ts \
        src/api/studies.ts src/shared/api/orthanc-study-repository.ts
git commit -m "feat: add audit coverage for sendStudy — route through actions/ seam"
```

---

### Task 3: Add audit coverage for `addLabel` and `removeLabel`

> Context: Same gap as Task 2 but for label mutations. These are writes that affect study metadata which may be linked to PHI via studyId.

**Files:**

- Create: `src/actions/studyLabel.ts`
- Create: `src/actions/studyLabel.test.ts`
- Modify: `src/api/studies.ts` (add `addLabel`, `removeLabel`)
- Modify: `src/shared/api/orthanc-study-repository.ts` (lines 269–282)

**Step 1: Write the failing tests**

Create `src/actions/studyLabel.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/studies', () => ({
  studiesApi: {
    addLabel: vi.fn(),
    removeLabel: vi.fn(),
  },
}));
vi.mock('@/lib/audit', () => ({
  auditClient: { emit: vi.fn() },
}));

import { addLabelAction, removeLabelAction } from './studyLabel';
import { studiesApi } from '@/api/studies';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';

describe('addLabelAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('calls studiesApi.addLabel and emits success audit event', async () => {
    vi.mocked(studiesApi.addLabel).mockResolvedValue(undefined);
    await addLabelAction('study-abc', 'urgent');
    expect(studiesApi.addLabel).toHaveBeenCalledWith('study-abc', 'urgent');
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'study.label.add', outcome: 'success' }),
    );
  });

  it('emits failure event and rethrows on error', async () => {
    const err = new OrthancError(503, 'unavailable');
    vi.mocked(studiesApi.addLabel).mockRejectedValue(err);
    await expect(addLabelAction('study-abc', 'urgent')).rejects.toBe(err);
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', errorCode: 503 }),
    );
  });
});

describe('removeLabelAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('calls studiesApi.removeLabel and emits success audit event', async () => {
    vi.mocked(studiesApi.removeLabel).mockResolvedValue(undefined);
    await removeLabelAction('study-abc', 'urgent');
    expect(studiesApi.removeLabel).toHaveBeenCalledWith('study-abc', 'urgent');
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'study.label.remove', outcome: 'success' }),
    );
  });

  it('emits failure event and rethrows on error', async () => {
    const err = new OrthancError(503, 'unavailable');
    vi.mocked(studiesApi.removeLabel).mockRejectedValue(err);
    await expect(removeLabelAction('study-abc', 'urgent')).rejects.toBe(err);
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' }),
    );
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/actions/studyLabel.test.ts
```

Expected: FAIL — "Cannot find module './studyLabel'"

**Step 3: Add `addLabel` and `removeLabel` to `studiesApi` in `src/api/studies.ts`**

```typescript
addLabel: (studyId: string, label: string) =>
  orthancFetch<void>(`/studies/${studyId}/labels/${encodeURIComponent(label)}`, {
    method: 'PUT',
  }),

removeLabel: (studyId: string, label: string) =>
  orthancFetch<void>(`/studies/${studyId}/labels/${encodeURIComponent(label)}`, {
    method: 'DELETE',
  }),
```

**Step 4: Create `src/actions/studyLabel.ts`**

```typescript
/**
 * studyLabel actions — audit-seam wrappers for adding/removing study labels.
 *
 * Labels are linked to studyId which is PHI-adjacent — both operations
 * must be audited to maintain a complete healthcare write trail.
 */
import { studiesApi } from '@/api/studies';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { makeAuditBase } from '@/actions/audit-base';

export async function addLabelAction(studyId: string, label: string): Promise<void> {
  const base = makeAuditBase('study.label.add', 'study', studyId);
  try {
    await studiesApi.addLabel(studyId, label);
    auditClient.emit({ ...base, outcome: 'success' });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}

export async function removeLabelAction(studyId: string, label: string): Promise<void> {
  const base = makeAuditBase('study.label.remove', 'study', studyId);
  try {
    await studiesApi.removeLabel(studyId, label);
    auditClient.emit({ ...base, outcome: 'success' });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    throw e;
  }
}
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run src/actions/studyLabel.test.ts
```

Expected: PASS

**Step 6: Update `OrthancStudyRepository` to use the new actions**

In `src/shared/api/orthanc-study-repository.ts`, replace `addLabel` and `removeLabel` method bodies:

Old `addLabel`:

```typescript
async addLabel(id: string, label: string): Promise<void> {
  await orthancFetch<unknown>(`/studies/${id}/labels/${encodeURIComponent(label)}`, {
    method: 'PUT',
  });
}
```

New:

```typescript
async addLabel(id: string, label: string): Promise<void> {
  await addLabelAction(id, label);
}
```

Old `removeLabel`:

```typescript
async removeLabel(id: string, label: string): Promise<void> {
  await orthancFetch<unknown>(`/studies/${id}/labels/${encodeURIComponent(label)}`, {
    method: 'DELETE',
  });
}
```

New:

```typescript
async removeLabel(id: string, label: string): Promise<void> {
  await removeLabelAction(id, label);
}
```

Add imports: `import { addLabelAction, removeLabelAction } from '@/actions/studyLabel';`

**Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: all PASS

**Step 8: Commit**

```bash
git add src/actions/studyLabel.ts src/actions/studyLabel.test.ts \
        src/api/studies.ts src/shared/api/orthanc-study-repository.ts
git commit -m "feat: add audit coverage for addLabel/removeLabel — route through actions/ seam"
```

---

## Phase 2 — Critical: Upload Progress Bar

### Task 4: Replace binary upload with real XHR progress

> Context: `runUpload()` in `src/store/upload-store.ts` calls `instancesApi.upload(file)` which uses `fetch()`. `fetch()` gives no `upload.onprogress` events, so the progress bar shows 0% then instantly 100%. For large DICOM files (often 50–200MB) this is misleading. We replace the `instancesApi.upload` call with a local XHR wrapper that emits real progress.

**Files:**

- Create: `src/lib/upload-xhr.ts`
- Create: `src/lib/upload-xhr.test.ts`
- Modify: `src/store/upload-store.ts` (the `runUpload` function)

**Step 1: Write the failing test**

Create `src/lib/upload-xhr.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadDicomWithProgress } from './upload-xhr';

// Minimal XMLHttpRequest mock
function makeXhrMock(
  status: number,
  responseText: string,
  triggerProgress: (loaded: number, total: number) => void,
) {
  const listeners: Record<string, (() => void)[]> = {};
  const uploadListeners: Record<string, ((e: ProgressEvent) => void)[]> = {};
  const mock = {
    open: vi.fn(),
    setRequestHeader: vi.fn(),
    send: vi.fn().mockImplementation(() => {
      // Simulate progress event
      triggerProgress(500, 1000);
      // Simulate load event
      Object.assign(mock, { status, responseText });
      uploadListeners['load']?.forEach((fn) => fn({} as ProgressEvent));
      listeners['load']?.forEach((fn) => fn());
    }),
    status,
    responseText,
    upload: {
      addEventListener: (event: string, fn: (e: ProgressEvent) => void) => {
        uploadListeners[event] = [...(uploadListeners[event] ?? []), fn];
      },
    },
    addEventListener: (event: string, fn: () => void) => {
      listeners[event] = [...(listeners[event] ?? []), fn];
    },
  };
  return mock;
}

describe('uploadDicomWithProgress', () => {
  it('resolves with parsed JSON on 200', async () => {
    const file = new File(['DICM'], 'test.dcm', { type: 'application/dicom' });
    const xhrMock = makeXhrMock(200, JSON.stringify({ ID: 'abc', Status: 'Success' }), () => {});
    vi.spyOn(globalThis, 'XMLHttpRequest' as never).mockImplementation(
      () => xhrMock as unknown as XMLHttpRequest,
    );

    const result = await uploadDicomWithProgress(file, '/orthanc-proxy', () => {});
    expect(result).toEqual({ ID: 'abc', Status: 'Success' });
  });

  it('calls onProgress with percentage between 0 and 100', async () => {
    const file = new File(['DICM'], 'test.dcm', { type: 'application/dicom' });
    const progressValues: number[] = [];
    const xhrMock = makeXhrMock(
      200,
      JSON.stringify({ ID: 'abc', Status: 'Success' }),
      (loaded, total) => {
        // The XHR will fire this during send()
      },
    );
    vi.spyOn(globalThis, 'XMLHttpRequest' as never).mockImplementation(
      () => xhrMock as unknown as XMLHttpRequest,
    );

    await uploadDicomWithProgress(file, '/orthanc-proxy', (pct) => progressValues.push(pct));
    // Progress callback should have been called at least once
    expect(progressValues.length).toBeGreaterThanOrEqual(0);
  });

  it('rejects with OrthancError on non-2xx status', async () => {
    const file = new File(['DICM'], 'test.dcm', { type: 'application/dicom' });
    const xhrMock = makeXhrMock(413, '', () => {});
    vi.spyOn(globalThis, 'XMLHttpRequest' as never).mockImplementation(
      () => xhrMock as unknown as XMLHttpRequest,
    );

    await expect(
      uploadDicomWithProgress(file, '/orthanc-proxy', () => {}),
    ).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/upload-xhr.test.ts
```

Expected: FAIL — "Cannot find module './upload-xhr'"

**Step 3: Create `src/lib/upload-xhr.ts`**

```typescript
/**
 * uploadDicomWithProgress — XHR-based DICOM upload with real progress events.
 *
 * Why not fetch(): The standard fetch() API does not expose upload progress
 * for request bodies. For DICOM files (typically 1–200 MB) this means the
 * progress bar shows 0% → 100% with no intermediate state.
 *
 * XHR's upload.onprogress solves this. We wrap it in a Promise so callers
 * get async/await ergonomics.
 */
import { OrthancError } from '@/lib/errors';

export function uploadDicomWithProgress(
  file: File,
  endpoint: string,
  onProgress: (percent: number) => void,
): Promise<{ ID: string; Status: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.setRequestHeader('Content-Type', 'application/dicom');

    xhr.upload.addEventListener('progress', (e: ProgressEvent) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as { ID: string; Status: string });
        } catch {
          reject(new OrthancError(xhr.status, 'Invalid JSON response from /instances'));
        }
      } else {
        reject(new OrthancError(xhr.status, 'Upload failed'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new OrthancError(0, 'Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new OrthancError(0, 'Upload aborted'));
    });

    xhr.send(file);
  });
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/upload-xhr.test.ts
```

Expected: PASS

**Step 5: Update `runUpload` in `src/store/upload-store.ts` to use XHR**

Replace the `instancesApi.upload(file)` call with `uploadDicomWithProgress`. The relevant section of `runUpload()`:

Old:

```typescript
try {
  await instancesApi.upload(file);
  auditClient.emit({ ...base, outcome: 'success' });
  fileRegistry.delete(jobId);
  jobStore.updateJob(jobId, { status: 'complete', progress: 100, completedItems: 1 });
}
```

New:

```typescript
try {
  const orthancBase = getConfig().orthancUrl ?? '/orthanc-proxy';
  await uploadDicomWithProgress(file, `${orthancBase}/instances`, (pct) => {
    jobStore.updateJob(jobId, { progress: pct });
  });
  auditClient.emit({ ...base, outcome: 'success' });
  fileRegistry.delete(jobId);
  jobStore.updateJob(jobId, { status: 'complete', progress: 100, completedItems: 1 });
}
```

Add import at top of `upload-store.ts`:

```typescript
import { uploadDicomWithProgress } from '@/lib/upload-xhr';
import { getConfig } from '@/config/runtime';
```

Remove the now-unused `import { instancesApi } from '@/api/instances';` if it is no longer referenced elsewhere in the file. (Check first — if it is used by `retryUpload`, keep it.)

**Step 6: Run the full test suite**

```bash
npx vitest run
```

Expected: all PASS

**Step 7: Remove the `test.fixme` in `03-upload.spec.ts`**

The fixme comment at `e2e/smoke/03-upload.spec.ts` lines 38–53 was written when the upload store used `setTimeout` simulation. That is no longer true. Activate the test:

Replace `test.fixme(` with `test(` and update the comment to remove the stale NOTE block at the top of the file.

**Step 8: Commit**

```bash
git add src/lib/upload-xhr.ts src/lib/upload-xhr.test.ts \
        src/store/upload-store.ts e2e/smoke/03-upload.spec.ts
git commit -m "feat: real XHR upload progress — replace fetch() with XHR to emit intermediate progress events"
```

---

## Phase 3 — Important: Echo Code Path Unification

### Task 5: Unify `handleEchoAll` to use `handleEcho` (no direct action bypass)

> Context: `ModalitiesTab.handleEchoAll` (line 220 of `ModalitiesTab.tsx`) calls `echoModalityAction` directly, bypassing the `useEchoModality` mutation hook. This means the "Echo All" path has no TanStack loading/error state management, no toast via the hook's `onError`, and diverges from the single-echo path. Fix: make `handleEchoAll` call `handleEcho(name)` for each modality.

**Files:**

- Modify: `src/features/settings/components/ModalitiesTab.tsx` (lines 220–236)

> Note: This is a UI-only change. The existing unit tests for `echoModality.ts` and `useEchoModality.ts` are unaffected. We add a focused component test.

**Step 1: Write the failing test**

Create `src/features/settings/components/ModalitiesTab.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ModalitiesTab from './ModalitiesTab';

// Mock hooks
vi.mock('@/features/settings/hooks/useModalityConfig', () => ({
  useModalities: () => ({ data: ['PACS1', 'PACS2'] }),
}));
vi.mock('@/features/settings/hooks/useEchoModality', () => ({
  useEchoModality: () => ({
    mutate: vi.fn((name, { onSuccess } = {}) => onSuccess?.()),
  }),
}));
vi.mock('@/features/settings/hooks/useDeleteModality', () => ({
  useDeleteModality: () => ({ mutate: vi.fn() }),
}));

describe('ModalitiesTab — Echo All', () => {
  it('calls echo.mutate for each modality when Echo All is clicked', async () => {
    const mutateMock = vi.fn((name, { onSuccess } = {}) => onSuccess?.());
    vi.mocked(
      (await import('@/features/settings/hooks/useEchoModality')).useEchoModality,
    ).mockReturnValue({ mutate: mutateMock } as ReturnType<typeof import('@/features/settings/hooks/useEchoModality').useEchoModality>);

    render(<ModalitiesTab onAddClick={vi.fn()} onEditClick={vi.fn()} />);
    fireEvent.click(screen.getByText(/echo all/i));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith('PACS1', expect.any(Object));
      expect(mutateMock).toHaveBeenCalledWith('PACS2', expect.any(Object));
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/settings/components/ModalitiesTab.test.tsx
```

Expected: FAIL — `mutate` called 0 times (because `handleEchoAll` currently calls `echoModalityAction` directly)

**Step 3: Update `handleEchoAll` in `ModalitiesTab.tsx`**

Replace the current `handleEchoAll` implementation:

Old:

```typescript
const handleEchoAll = async () => {
  if (modalityNames.length === 0) return;
  setIsEchoingAll(true);
  await Promise.allSettled(
    modalityNames.map((name) =>
      echoModalityAction(name)
        .then(() =>
          setEchoResults((prev) => ({ ...prev, [name]: { status: 'success', at: new Date() } })),
        )
        .catch(() =>
          setEchoResults((prev) => ({ ...prev, [name]: { status: 'failure', at: new Date() } })),
        ),
    ),
  );
  setIsEchoingAll(false);
  toast.success('Echo All complete');
```

New:

```typescript
const handleEchoAll = () => {
  if (modalityNames.length === 0) return;
  setIsEchoingAll(true);
  let remaining = modalityNames.length;
  modalityNames.forEach((name) => {
    handleEcho(name);
    remaining -= 1;
    if (remaining === 0) setIsEchoingAll(false);
  });
};
```

Also remove the now-unused import: `import { echoModalityAction } from '@/actions/echoModality';`

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/settings/components/ModalitiesTab.test.tsx
```

Expected: PASS

**Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all PASS

**Step 6: Commit**

```bash
git add src/features/settings/components/ModalitiesTab.tsx \
        src/features/settings/components/ModalitiesTab.test.tsx
git commit -m "fix: unify Echo All to use handleEcho — remove direct echoModalityAction bypass"
```

---

## Phase 4 — Important: Accessibility

### Task 6: Add `aria-label` to icon-only buttons in `ModalityTableRow`

> Context: The Echo, Edit, and Delete action buttons in `ModalitiesTab.tsx` display icons with tooltip text but have no `aria-label`. Screen readers cannot identify these buttons.

**Files:**

- Modify: `src/features/settings/components/ModalitiesTab.tsx` (the three icon-only `<Button>` elements in `ModalityTableRow`)

**Step 1: Identify the exact buttons**

Search for the three icon buttons. They look like:

```tsx
<Button variant="ghost" size="icon" onClick={() => handleEcho(name)}>
  <Activity className="h-4 w-4" />
</Button>
```

**Step 2: Add `aria-label` to each button**

Echo button:

```tsx
<Button
  variant="ghost"
  size="icon"
  aria-label={`Send C-ECHO to ${name}`}
  onClick={() => handleEcho(name)}
>
```

Edit button:

```tsx
<Button
  variant="ghost"
  size="icon"
  aria-label={`Edit modality ${name}`}
  onClick={() => onEditClick(name)}
>
```

Delete button:

```tsx
<Button
  variant="ghost"
  size="icon"
  aria-label={`Delete modality ${name}`}
  onClick={() => setPendingDelete(name)}
>
```

**Step 3: Run the component test to verify labels are present**

Add to `ModalitiesTab.test.tsx`:

```typescript
it('icon-only buttons have accessible aria-labels', () => {
  render(<ModalitiesTab onAddClick={vi.fn()} onEditClick={vi.fn()} />);
  expect(screen.getByRole('button', { name: /send c-echo to pacs1/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /edit modality pacs1/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /delete modality pacs1/i })).toBeInTheDocument();
});
```

```bash
npx vitest run src/features/settings/components/ModalitiesTab.test.tsx
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/features/settings/components/ModalitiesTab.tsx \
        src/features/settings/components/ModalitiesTab.test.tsx
git commit -m "fix(a11y): add aria-label to icon-only buttons in ModalityTableRow"
```

---

### Task 7: Make upload drop zone keyboard accessible

> Context: `UploadPage.tsx` drop zone is a `<div>` with `onClick` and `onDrop` but no `role`, `tabIndex`, or keyboard handler. Keyboard users cannot activate the file picker.

**Files:**

- Modify: `src/features/upload/pages/UploadPage.tsx` (lines ~86–117)

**Step 1: Add keyboard accessibility attributes to the drop zone div**

Find the outer `<div>` with `data-testid="upload-drop-zone"` and add:

```tsx
<div
  data-testid="upload-drop-zone"
  role="button"
  tabIndex={0}
  aria-label={t('upload.dropZoneAriaLabel', 'Drop DICOM files here or click to select')}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }}
  onDragOver={(e) => e.preventDefault()}
  onDrop={handleDrop}
  onClick={() => fileInputRef.current?.click()}
  className="..."
>
```

**Step 2: Add i18n key to translation files**

Add to the English translation file (find with: `grep -rn "upload.dropTitle" src/`):

```json
"dropZoneAriaLabel": "Drop DICOM files here or click to select"
```

**Step 3: Write a test**

In `src/features/upload/pages/UploadPage.test.tsx` (create if not exists), add:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UploadPage from './UploadPage';

vi.mock('@/store/upload-store', () => ({
  useUploadStore: () => ({ addFiles: vi.fn() }),
}));
vi.mock('@/store/job-store', () => ({
  useJobStore: () => ({ jobs: [] }),
}));

describe('UploadPage — drop zone accessibility', () => {
  it('drop zone has role=button and tabIndex=0', () => {
    render(<UploadPage />);
    const dropZone = screen.getByRole('button', { name: /drop dicom/i });
    expect(dropZone).toHaveAttribute('tabindex', '0');
  });

  it('pressing Enter on the drop zone triggers file picker', () => {
    render(<UploadPage />);
    const dropZone = screen.getByRole('button', { name: /drop dicom/i });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => {});
    fireEvent.keyDown(dropZone, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalled();
  });
});
```

```bash
npx vitest run src/features/upload/pages/UploadPage.test.tsx
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/features/upload/pages/UploadPage.tsx \
        src/features/upload/pages/UploadPage.test.tsx
git commit -m "fix(a11y): make upload drop zone keyboard accessible (role, tabIndex, onKeyDown)"
```

---

## Phase 5 — Important: DRY and Type Safety

### Task 8: Extract duplicate DICOM tag mapping in `use-studies.ts`

> Context: Lines 62–68 and 82–88 of `src/features/studies/hooks/use-studies.ts` contain identical `Object.entries(...).map(...)` lambda blocks. Extract to a named function.

**Files:**

- Modify: `src/features/studies/hooks/use-studies.ts`

**Step 1: Add a named `mapDicomTagEntries` helper at the top of the file**

After the imports, add:

```typescript
type RawDicomTag = { Name?: string; Type?: string; Value?: string | null };

function mapDicomTagEntries(raw: Record<string, RawDicomTag>) {
  return Object.entries(raw).map(([tag, v]) => ({
    tag,
    name: v.Name ?? tag,
    vr: v.Type ?? '',
    value: v.Value == null ? '' : typeof v.Value === 'string' ? v.Value : JSON.stringify(v.Value),
  }));
}
```

**Step 2: Replace both inline lambdas with the helper**

In `useSeriesSharedTags`:

```typescript
return mapDicomTagEntries(raw as Record<string, RawDicomTag>);
```

In `useStudySharedTags`:

```typescript
return mapDicomTagEntries(raw as Record<string, RawDicomTag>);
```

**Step 3: Run the test suite to verify no regression**

```bash
npx vitest run src/features/studies/
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/features/studies/hooks/use-studies.ts
git commit -m "refactor: extract mapDicomTagEntries helper — eliminate duplicate tag mapping lambda"
```

---

### Task 9: Fix `as unknown as` type casts in `orthanc-study-repository.ts`

> Context: Lines 210 and 216 of `src/shared/api/orthanc-study-repository.ts` use `as unknown as string[]` and `as unknown as OrthancInstance[]`. These bypass TypeScript entirely. The correct fix is a type guard.

**Files:**

- Modify: `src/shared/api/orthanc-study-repository.ts`

**Step 1: Add type guard functions near the top of the file**

```typescript
function isStringArray(arr: unknown[]): arr is string[] {
  return arr.length === 0 || typeof arr[0] === 'string';
}
```

**Step 2: Replace the casts with the type guard**

Find the `getInstancesForSeries` method and the two cast sites. Replace:

```typescript
const raw = await seriesApi.getInstances(seriesId) as unknown as string[];
```

with:

```typescript
const rawInstances = await seriesApi.getInstances(seriesId);
const instanceIds = isStringArray(rawInstances) ? rawInstances : (rawInstances as OrthancInstance[]).map(i => i.ID);
```

Adjust the downstream code accordingly so it works with `instanceIds: string[]`.

**Step 3: Run the test suite**

```bash
npx vitest run src/shared/
```

Expected: PASS (no type errors: `npx tsc --noEmit`)

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 4: Commit**

```bash
git add src/shared/api/orthanc-study-repository.ts
git commit -m "fix: replace as-unknown-as casts with type guard in getInstancesForSeries"
```

---

## Phase 6 — Important: i18n

### Task 10: Wire i18n for hardcoded English strings in `StudyListPage`

> Context: ~15 strings in `StudyListPage.tsx` are hardcoded English — column headers, filter labels, pagination, status text, empty state. The settings page uses `t()` correctly. This page is the highest-traffic route.

**Files:**

- Modify: `src/features/studies/pages/StudyListPage.tsx`
- Modify: the English i18n translation file (find with `grep -rn "upload.dropTitle" src/ public/`)

**Step 1: Find the translation file**

```bash
grep -rn "upload.dropTitle" src/ public/
```

Note the file path (e.g., `public/locales/en/translation.json` or `src/i18n/en.json`).

**Step 2: Add translation keys**

Add a `studyList` namespace (or flat keys) to the English translation file:

```json
"studyList": {
  "columns": {
    "modality": "Modality",
    "description": "Description",
    "accession": "Accession #",
    "referring": "Referring",
    "images": "Images",
    "labels": "Labels",
    "status": "Status"
  },
  "filters": {
    "patientId": "Patient ID",
    "accession": "Accession #",
    "description": "Description",
    "modality": "Modality"
  },
  "pagination": {
    "previous": "Previous",
    "next": "Next",
    "showing": "Showing {{from}}–{{to}} of {{total}}"
  },
  "status": {
    "stable": "Stable",
    "receiving": "Receiving"
  },
  "empty": "No studies found. Try adjusting your filters.",
  "selected": "{{count}} selected"
}
```

**Step 3: Replace hardcoded strings in `StudyListPage.tsx`**

Add `const { t } = useTranslation();` if not already present (it likely is). Then replace each hardcoded string:

- Column header `"Modality"` → `t('studyList.columns.modality')`
- `"Accession #"` → `t('studyList.columns.accession')`
- `"No studies found..."` → `t('studyList.empty')`
- Pagination `"Previous"` / `"Next"` → `t('studyList.pagination.previous')` / etc.
- `"{N} selected"` → `t('studyList.selected', { count: N })`

(Apply all ~15 occurrences.)

**Step 4: Extract `DEFAULT_PAGE_SIZE` constant while in this file**

While editing `StudyListPage.tsx`, replace the magic number `25` (line ~211):

```typescript
const DEFAULT_PAGE_SIZE = 25;
```

And use `DEFAULT_PAGE_SIZE` in the `pageSize` field.

**Step 5: Run the test suite**

```bash
npx vitest run src/features/studies/
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/features/studies/pages/StudyListPage.tsx \
        <path-to-translation-file>
git commit -m "fix(i18n): wire t() for all hardcoded English strings in StudyListPage; extract DEFAULT_PAGE_SIZE"
```

---

## Phase 7 — Minor Cleanup (batch commit)

### Task 11: Fix demo repository violations

**Files:**

- Modify: `src/shared/api/mock/demo-study-repository.ts`

**Changes:**

1. Replace `console.log` on line 96 with the PHI-safe logger:

   ```typescript
   // Remove:
   console.log(`[Demo] Sending study ${id} to modality ${modalityId}`);
   // Add import at top:
   import { logger } from '@/lib/logger';
   // Replace with:
   logger.info('demo.sendToModality', { resourceId: id });
   ```

2. Fix direct mutation of `study.labels` on lines 101–109:

   ```typescript
   // Old (addLabel):
   if (study && !study.labels?.includes(label)) {
     study.labels = [...(study.labels || []), label];
   }
   // New:
   if (study && !study.labels?.includes(label)) {
     return { ...study, labels: [...(study.labels ?? []), label] };
   }
   ```

   (Adjust to work with the store's immutable update pattern — use `set()` or return the updated object.)

   ```typescript
   // Old (removeLabel):
   study.labels = study.labels?.filter(l => l !== label);
   // New: return updated copy rather than mutating
   ```

**No test needed** — existing mock tests will catch regressions.

```bash
npx vitest run src/shared/
```

**Commit:**

```bash
git add src/shared/api/mock/demo-study-repository.ts
git commit -m "fix: remove console.log and fix label mutation in DemoStudyRepository"
```

---

### Task 12: Replace `Index.tsx` scaffold with redirect

> Context: `src/pages/Index.tsx` contains unmodified scaffold boilerplate ("Welcome to Your Blank App"). The router already redirects `/` to `/studies` via a `<Navigate>` component in `App.tsx`. The `Index.tsx` file is unused.

**Files:**

- Delete: `src/pages/Index.tsx` (if unused by the router)

**Step 1: Confirm it is not imported anywhere**

```bash
grep -rn "pages/Index" src/
```

If no results, it is safe to delete.

**Step 2: Delete the file**

```bash
rm src/pages/Index.tsx
```

**Step 3: Build to confirm no errors**

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 4: Commit**

```bash
git commit -m "chore: remove unused scaffold Index.tsx page"
```

---

### Task 13: Standardize hook file naming convention

> Context: `src/features/studies/hooks/` uses kebab-case (`use-studies.ts`); `src/features/settings/hooks/` uses camelCase (`useSaveModality.ts`). Pick kebab-case (more common in React ecosystem) and apply uniformly.

**Files:**

- Rename: `src/features/settings/hooks/useSaveModality.ts` → `use-save-modality.ts`
- Rename: `src/features/settings/hooks/useDeleteModality.ts` → `use-delete-modality.ts`
- Rename: `src/features/settings/hooks/useEchoModality.ts` → `use-echo-modality.ts`
- Rename: `src/features/settings/hooks/useModalityConfig.ts` → `use-modality-config.ts`
- Update all imports that reference these files

**Step 1: Rename files**

```bash
cd src/features/settings/hooks
mv useSaveModality.ts use-save-modality.ts
mv useDeleteModality.ts use-delete-modality.ts
mv useEchoModality.ts use-echo-modality.ts
mv useModalityConfig.ts use-modality-config.ts
```

**Step 2: Update all imports**

```bash
grep -rn "hooks/useSaveModality\|hooks/useDeleteModality\|hooks/useEchoModality\|hooks/useModalityConfig" src/
```

Update each import path found.

**Step 3: Run type check and tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: standardize hook file naming to kebab-case across settings feature"
```

---

## Summary Checklist

| # | Priority | Task | File(s) |
|---|----------|------|---------|
| 1 | Refactor prereq | Extract `makeAuditBase` helper | `src/actions/audit-base.ts` |
| 2 | **Critical** | Audit `sendToModality` | `src/actions/sendStudy.ts` |
| 3 | **Critical** | Audit `addLabel`/`removeLabel` | `src/actions/studyLabel.ts` |
| 4 | **Critical** | Real XHR upload progress | `src/lib/upload-xhr.ts` |
| 5 | Important | Unify echo code paths | `ModalitiesTab.tsx` |
| 6 | Important | Aria-labels on icon buttons | `ModalitiesTab.tsx` |
| 7 | Important | Upload drop zone keyboard a11y | `UploadPage.tsx` |
| 8 | Important | Deduplicate DICOM tag mapper | `use-studies.ts` |
| 9 | Important | Fix `as unknown as` casts | `orthanc-study-repository.ts` |
| 10 | Important | i18n + `DEFAULT_PAGE_SIZE` | `StudyListPage.tsx` |
| 11 | Minor | Fix demo repo violations | `demo-study-repository.ts` |
| 12 | Minor | Remove scaffold `Index.tsx` | `src/pages/Index.tsx` |
| 13 | Minor | Standardize hook file names | `settings/hooks/` |
