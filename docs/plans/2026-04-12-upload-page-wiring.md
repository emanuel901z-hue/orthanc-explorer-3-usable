# Upload Page End-to-End Wiring

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the simulated upload in `src/store/upload-store.ts` with real `POST /instances` API calls, wire per-file job tracking, audit events, and retry, so smoke checklist item 7 passes.

**Architecture:** The upload store keeps a module-level `fileRegistry` (a `Map<string, File>`) that persists file references for retry without breaking Zustand's JSON serialization. Each file gets its own job entry in the job store, updated as the upload progresses. The UploadPage retry button calls `retryUpload(id)` from the upload store rather than `retryJob(id)` from the job store.

**Tech Stack:** Zustand, `instancesApi.upload()` (existing), `auditClient.emit()` (existing), Vitest + React Testing Library

---

## Context & Gap Analysis

| Layer | Current state | Gap |
|-------|--------------|-----|
| `src/store/upload-store.ts` | Fake `setTimeout/setInterval` simulation | **Must be replaced** with real API calls |
| `src/api/instances.ts` | `instancesApi.upload(file)` — fully implemented | No gap |
| `src/actions/uploadInstances.ts` | Batch wrapper with audit | Not used; store should call `instancesApi.upload` directly for per-file tracking |
| `src/lib/audit.ts` | `auditClient.emit()` — fully implemented | Not called from upload store |
| `src/store/job-store.ts` | `retryJob(id)` resets status to pending | Does NOT re-trigger upload |
| `src/features/upload/pages/UploadPage.tsx` | Calls `retryJob(id)` for upload jobs | Must call `retryUpload(id)` from upload store instead |
| `src/store/upload-store.test.ts` | Does not exist | Must be created |
| `src/features/upload/store/upload-store.ts` | Duplicate of `src/store/upload-store.ts` | Dead code — delete after Task 1 confirms nothing imports it |

---

## Task 1: Confirm the duplicate upload store is unused, then delete it

**Files:**

- Delete: `src/features/upload/store/upload-store.ts`

**Step 1: Search for imports of the feature-path upload store**

```bash
grep -r "features/upload/store" src/
```

Expected: no output (nothing imports it — `UploadPage` imports from `@/store/upload-store`).

**Step 2: Delete the duplicate**

```bash
rm src/features/upload/store/upload-store.ts
rmdir src/features/upload/store 2>/dev/null || true
```

**Step 3: Run tests to confirm nothing broke**

```bash
npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all existing tests pass.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove duplicate upload-store in features/upload/store"
```

---

## Task 2: Write failing tests for the real upload store

**Files:**

- Create: `src/store/upload-store.test.ts`

**Step 1: Create the test file**

```typescript
// src/store/upload-store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUploadStore } from './upload-store';
import { instancesApi } from '@/api/instances';
import { auditClient } from '@/lib/audit';
import { useJobStore } from './job-store';

beforeEach(() => {
  vi.restoreAllMocks();
  useJobStore.setState({ jobs: [] });
});

describe('addFiles()', () => {
  it('calls instancesApi.upload once per file', async () => {
    const uploadSpy = vi.spyOn(instancesApi, 'upload').mockResolvedValue({ ID: 'x', Status: 'Success' });
    vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm'), new File(['b'], 'b.dcm')]);

    await vi.waitFor(() => expect(uploadSpy).toHaveBeenCalledTimes(2));
  });

  it('creates a job per file with type upload', async () => {
    vi.spyOn(instancesApi, 'upload').mockResolvedValue({ ID: 'x', Status: 'Success' });
    vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].label).toBe('a.dcm');
  });

  it('marks the job complete when upload succeeds', async () => {
    vi.spyOn(instancesApi, 'upload').mockResolvedValue({ ID: 'x', Status: 'Success' });
    vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs[0].status).toBe('complete');
      expect(jobs[0].progress).toBe(100);
    });
  });

  it('marks the job as error when upload fails', async () => {
    vi.spyOn(instancesApi, 'upload').mockRejectedValue(new Error('network error'));
    vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs[0].status).toBe('error');
    });
  });

  it('emits a success audit event when upload succeeds', async () => {
    vi.spyOn(instancesApi, 'upload').mockResolvedValue({ ID: 'x', Status: 'Success' });
    const auditSpy = vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() =>
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'instance.upload', outcome: 'success' }),
      ),
    );
  });

  it('emits a failure audit event when upload fails', async () => {
    vi.spyOn(instancesApi, 'upload').mockRejectedValue(new Error('network error'));
    const auditSpy = vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    await vi.waitFor(() =>
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'instance.upload', outcome: 'failure' }),
      ),
    );
  });
});

describe('retryUpload()', () => {
  it('re-calls instancesApi.upload for the same file after a failure', async () => {
    const uploadSpy = vi.spyOn(instancesApi, 'upload')
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ ID: 'x', Status: 'Success' });
    vi.spyOn(auditClient, 'emit').mockImplementation(() => {});

    useUploadStore.getState().addFiles([new File(['a'], 'a.dcm')]);

    // Wait for error
    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs[0].status).toBe('error');
    });

    const jobId = useJobStore.getState().jobs.filter((j) => j.type === 'upload')[0].id;
    useUploadStore.getState().retryUpload(jobId);

    // Wait for success
    await vi.waitFor(() => {
      const jobs = useJobStore.getState().jobs.filter((j) => j.type === 'upload');
      expect(jobs[0].status).toBe('complete');
    });

    expect(uploadSpy).toHaveBeenCalledTimes(2);
  });

  it('does nothing when jobId is unknown (file no longer in registry)', () => {
    const uploadSpy = vi.spyOn(instancesApi, 'upload').mockResolvedValue({ ID: 'x', Status: 'Success' });
    useUploadStore.getState().retryUpload('nonexistent-id');
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run the tests — they must fail**

```bash
npx vitest run src/store/upload-store.test.ts --reporter=verbose
```

Expected: tests fail because the store still has simulation code (no real `instancesApi.upload` call, no `retryUpload` function).

**Do not commit yet.**

---

## Task 3: Implement the real upload store

**Files:**

- Modify: `src/store/upload-store.ts`

**Step 1: Replace the entire file with the real implementation**

```typescript
// PHI classification: SESSION (may hold PHI — memory-only)
// File names passed to addFiles() may contain patient-identifying information.
import { create } from 'zustand';
import { instancesApi } from '@/api/instances';
import { auditClient } from '@/lib/audit';
import { OrthancError } from '@/lib/errors';
import { useJobStore } from './job-store';

// Module-level registry: File objects cannot be JSON-serialized,
// so we keep them outside Zustand persist scope.
const fileRegistry = new Map<string, File>();

async function runUpload(jobId: string, file: File): Promise<void> {
  const jobStore = useJobStore.getState();
  jobStore.updateJob(jobId, { status: 'running', progress: 0 });

  const base = {
    action: 'instance.upload',
    resourceType: 'instance' as const,
    resourceId: file.name,
    timestamp: new Date().toISOString(),
  };

  try {
    await instancesApi.upload(file);
    auditClient.emit({ ...base, outcome: 'success' });
    fileRegistry.delete(jobId);
    jobStore.updateJob(jobId, { status: 'complete', progress: 100 });
  } catch (e) {
    auditClient.emit({
      ...base,
      outcome: 'failure',
      errorCode: e instanceof OrthancError ? e.status : undefined,
    });
    jobStore.updateJob(jobId, {
      status: 'error',
      error: e instanceof OrthancError ? e.message : 'Upload failed',
    });
    // Keep file in registry so retryUpload() can re-use it.
  }
}

interface UploadState {
  addFiles: (files: File[]) => void;
  retryUpload: (id: string) => void;
}

export const useUploadStore = create<UploadState>(() => ({
  addFiles: (files) => {
    const jobStore = useJobStore.getState();
    files.forEach((file, i) => {
      const jobId = `upload-${Date.now()}-${i}`;
      fileRegistry.set(jobId, file);
      jobStore.addJob({
        id: jobId,
        type: 'upload',
        label: file.name,
        description: formatSize(file.size),
        progress: 0,
        status: 'pending',
        totalItems: file.size,
        completedItems: 0,
      });
      void runUpload(jobId, file);
    });
  },

  retryUpload: (id) => {
    const file = fileRegistry.get(id);
    if (!file) return;
    const jobStore = useJobStore.getState();
    jobStore.updateJob(id, { status: 'pending', progress: 0, error: undefined });
    void runUpload(id, file);
  },
}));

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

**Step 2: Run the tests — they must pass**

```bash
npx vitest run src/store/upload-store.test.ts --reporter=verbose
```

Expected: all 8 tests pass.

**Step 3: Run the full test suite — no regressions**

```bash
npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add src/store/upload-store.ts src/store/upload-store.test.ts
git commit -m "feat(upload): replace simulated upload with real POST /instances + audit events"
```

---

## Task 4: Wire UploadPage retry button to upload store

**Files:**

- Modify: `src/features/upload/pages/UploadPage.tsx`

The UploadPage currently calls `retryJob(item.id)` from the job store. This only resets the job status but never re-triggers the actual upload. It needs to call `retryUpload(id)` from the upload store instead.

**Step 1: Read the current retry button code**

Open [src/features/upload/pages/UploadPage.tsx](src/features/upload/pages/UploadPage.tsx) and find this block (around line 14):

```typescript
const { jobs, removeJob, clearCompleted, retryJob } = useJobStore();
```

And around line 166:

```tsx
onClick={() => retryJob(item.id)
```

**Step 2: Apply the two-line change**

Change line 13-14 from:

```typescript
const { jobs, removeJob, clearCompleted, retryJob } = useJobStore();
```

to:

```typescript
const { jobs, removeJob, clearCompleted } = useJobStore();
const { addFiles, retryUpload } = useUploadStore();
```

Change the retry button onClick (line ~166) from:

```tsx
onClick={() => retryJob(item.id)}
```

to:

```tsx
onClick={() => retryUpload(item.id)}
```

**Step 3: TypeScript check — no errors**

```bash
npx tsc --noEmit
```

Expected: exits 0, no errors.

**Step 4: Run all tests — no regressions**

```bash
npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/features/upload/pages/UploadPage.tsx
git commit -m "fix(upload): retry button now re-triggers real upload via retryUpload()"
```

---

## Task 5: Manual smoke test against live stack

This verifies checklist item 7 end-to-end with a real Orthanc server.

**Step 1: Start the dev stack (if not already running)**

```bash
docker compose -f docker-compose.dev.yml up -d
```

Wait until all three containers show `(healthy)`:

```bash
docker compose -f docker-compose.dev.yml ps
```

**Step 2: Start the dev server**

```bash
npm run dev
```

App should load at `http://localhost:5173`.

**Step 3: Run the drag-drop upload test**

1. Open Chrome devtools → Network tab, filter by `instances`
2. Navigate to `http://localhost:5173/upload`
3. Drag `test-data/sample.dcm` onto the drop zone
4. Observe:
   - A row appears in the queue with status `running`
   - Network tab shows **POST `/orthanc-proxy/instances`** (dev proxy) with `Content-Type: application/dicom`
   - Row status changes to `complete` (green checkmark)
5. Verify in Orthanc:

   ```bash
   curl -s http://localhost:8042/instances | jq length
   ```

   Expected: count increased by 1.

**Step 4: Test the retry flow**

1. Stop the Orthanc container temporarily:

   ```bash
   docker stop orthanc-explorer-3-orthanc-1
   ```

2. Drag `test-data/sample.dcm` onto the drop zone
3. The upload should fail (row shows error / orange triangle)
4. Restart Orthanc:

   ```bash
   docker start orthanc-explorer-3-orthanc-1
   ```

5. Click the retry button (↻) on the failed row
6. Row should transition: `pending` → `running` → `complete`

**Step 5: Check the smoke checklist**

Open [docs/plans/2026-04-11-v0.1-smoke-checklist.md](docs/plans/2026-04-11-v0.1-smoke-checklist.md) and mark item 7 checked:

```markdown
## 7. Upload — drag-drop

- [x] Navigate to Upload page
- [x] Drag `test-data/sample.dcm` onto the drop zone
- [x] Upload completes and reports success
- [x] Network tab shows POST to `/instances` with `Content-Type: application/dicom`
```

**Step 6: Commit the updated checklist**

```bash
git add docs/plans/2026-04-11-v0.1-smoke-checklist.md
git commit -m "docs: mark smoke checklist item 7 (upload) as verified"
```

---

## Done Criteria

- [ ] `src/features/upload/store/upload-store.ts` (dead duplicate) deleted
- [ ] `src/store/upload-store.test.ts` created with 8 passing tests
- [ ] `src/store/upload-store.ts` calls `instancesApi.upload()` and `auditClient.emit()` per file
- [ ] `retryUpload(id)` re-triggers actual upload using the stored `File` reference
- [ ] `UploadPage.tsx` retry button calls `retryUpload(id)` (not `retryJob`)
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run` exits 0 (all tests pass)
- [ ] Manual smoke: POST to `/instances` visible in Network tab, job reaches `complete`
- [ ] Smoke checklist item 7 marked `[x]`
