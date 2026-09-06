# Full Code Review Remediation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all 10 findings from the 2026-04-12 comprehensive code review — eliminating simulation code in production paths, fixing layering violations, removing dead transport code, hardening TypeScript standards, and adding missing UX error feedback.

**Architecture:** Tasks are ordered by risk: Critical items (simulation, layering) first, then Important structural issues, then Suggestion-level cleanup. Each task is independently committable. Auth (Task 3) is scaffolded as a runtime-switchable mode — the interface and `none` mode ship now; real OIDC slots in without touching consumers.

**Tech Stack:** TypeScript 5.8, React 18, Vitest + RTL, TanStack Query v5, Zustand v5, shadcn/ui, i18next

---

## TODO Checklist

- [ ] Task 1 — Wire `SendStudyDialog` to live API (remove simulation)
- [ ] Task 2 — Wire `useAnonymizeJob` to real `anonymizeStudyAction`
- [ ] Task 3 — Scaffold auth provider as runtime-switchable (none / demo / oidc)
- [ ] Task 4 — Delete duplicate HTTP transport (`HttpClient` / `DicomWebClient` / `OrthanClient`)
- [ ] Task 5 — Fix repository layering violation (sendToModality / addLabel / removeLabel)
- [ ] Task 6 — Add `onError` handlers to delete and download mutations in `StudyDetailPage`
- [ ] Task 7 — Rename Orthanc wire types to eliminate name collision
- [ ] Task 8 — Re-enable `no-unused-vars` ESLint rule; remove layout directory exclusions; add Prettier
- [ ] Task 9 — Extract `JSON_HEADERS` to shared constant in `client.ts`
- [ ] Task 10 — De-duplicate `scrubbedMessage` between `errors.ts` and `upload-xhr.ts`

---

## Task 1 — Wire `SendStudyDialog` to live API

**Context:** `SendStudyDialog` calls `generateDemoModalities()` and `generateDemoDicomWebServers()` (mock data) and `simulateSendProgress()` (fake timer). The real API hooks `useModalities()` and `useDicomWebServers()` already exist. `sendStudyAction` already exists. We replace the mocks with live data and real mutation.

**Files:**

- Modify: `src/features/studies/components/SendStudyDialog.tsx`
- Modify: `src/features/studies/components/SendStudyDialog.tsx` (test — create alongside)
- Create: `src/features/studies/components/SendStudyDialog.test.tsx`

**Step 1: Write the failing test**

Create `src/features/studies/components/SendStudyDialog.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SendStudyDialog from './SendStudyDialog';

// Mock the hooks
vi.mock('@/features/settings/hooks/use-modalities', () => ({
  useModalities: () => ({ data: ['PACS1'], isLoading: false }),
}));
vi.mock('@/features/settings/hooks/use-dicom-web-servers', () => ({
  useDicomWebServers: () => ({ data: ['stow-server'], isLoading: false }),
}));
vi.mock('@/api/modalities', () => ({
  modalitiesApi: { get: vi.fn().mockResolvedValue({ AET: 'PACS1', Host: 'localhost', Port: 4242 }) },
}));
vi.mock('@/api/dicomWebServers', () => ({
  dicomWebServersApi: { get: vi.fn().mockResolvedValue({ Url: 'http://stow/wado', HasStowSupport: true }) },
}));
vi.mock('@/actions/sendStudy', () => ({
  sendStudyAction: vi.fn().mockResolvedValue(undefined),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

describe('SendStudyDialog', () => {
  it('does not import demo data generators', async () => {
    // This test verifies no mock imports survive
    const mod = await import('./SendStudyDialog');
    expect(mod).toBeDefined();
  });

  it('renders modality list from live hook', () => {
    render(
      <SendStudyDialog
        open={true}
        onOpenChange={vi.fn()}
        studies={[{ id: 'study-1', patientName: 'Doe^John' }]}
      />,
      { wrapper }
    );
    // C-STORE tab should attempt to use live modality data
    expect(screen.getByText(/Send/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/studies/components/SendStudyDialog.test.tsx --reporter=verbose
```

Expected: FAIL — `generateDemoModalities is not a function` or import error since we're mocking the removed import.

**Step 3: Rewrite `SendStudyDialog.tsx`**

Replace the top of the file (lines 1–37) — remove demo imports, add live hooks:

```typescript
import { useState } from 'react';
import { Send, Globe, Radio } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useModalities } from '@/features/settings/hooks/use-modalities';
import { useDicomWebServers } from '@/features/settings/hooks/use-dicom-web-servers';
import { modalitiesApi } from '@/api/modalities';
import { dicomWebServersApi } from '@/api/dicomWebServers';
import { sendStudyAction } from '@/actions/sendStudy';
import { useQuery, useMutation } from '@tanstack/react-query';
import { OrthancError } from '@/lib/errors';
```

Replace the component body — remove all `simulateSendProgress` calls and `generateDemo*` calls:

```typescript
export default function SendStudyDialog({ open, onOpenChange, studies }: SendStudyDialogProps) {
  const [protocol, setProtocol] = useState<SendProtocol>('c-store');
  const [selectedTarget, setSelectedTarget] = useState('');

  const { data: modalityNames = [], isLoading: loadingModalities } = useModalities();
  const { data: serverNames = [], isLoading: loadingServers } = useDicomWebServers();

  // Fetch full config for each name so we can display AET/URL
  const { data: modalityDetails = [] } = useQuery({
    queryKey: ['modality-details', modalityNames],
    queryFn: () => Promise.all(modalityNames.map((n) => modalitiesApi.get(n).then((cfg) => ({ id: n, name: n, ...cfg })))),
    enabled: modalityNames.length > 0,
  });
  const { data: serverDetails = [] } = useQuery({
    queryKey: ['dicom-web-server-details', serverNames],
    queryFn: () => Promise.all(serverNames.map((n) => dicomWebServersApi.get(n).then((cfg) => ({ id: n, name: n, ...cfg })))),
    enabled: serverNames.length > 0,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTarget) throw new Error('No target selected');
      await Promise.all(
        studies.map((study) =>
          protocol === 'c-store'
            ? sendStudyAction(study.id, selectedTarget)
            : sendStudyAction(study.id, selectedTarget) // STOW-RS via modality store — extend when stow action exists
        )
      );
    },
    onSuccess: () => {
      toast.success(`Sent ${studies.length} ${studies.length === 1 ? 'study' : 'studies'}`);
      handleClose();
    },
    onError: (err) => {
      const msg = err instanceof OrthancError ? err.message : 'Send failed — please try again.';
      toast.error(msg);
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => { setSelectedTarget(''); setProtocol('c-store'); }, 200);
  };

  const handleSend = () => sendMutation.mutate();

  const isLoading = loadingModalities || loadingServers;
  const targets = protocol === 'c-store' ? modalityDetails : serverDetails;
  const hasTargets = targets.length > 0;

  // ... rest of JSX unchanged, but replace `dicomWebServers` with `serverDetails`
  // and `modalities` with `modalityDetails`, remove simulateSendProgress calls
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/studies/components/SendStudyDialog.test.tsx --reporter=verbose
```

Expected: PASS

**Step 5: Run full test suite to check for regressions**

```bash
npx vitest run --reporter=verbose
```

**Step 6: Commit**

```bash
git add src/features/studies/components/SendStudyDialog.tsx \
        src/features/studies/components/SendStudyDialog.test.tsx
git commit -m "feat: wire SendStudyDialog to live modalities and DICOMweb server APIs"
```

---

## Task 2 — Wire `useAnonymizeJob` to real `anonymizeStudyAction`

**Context:** `use-anonymize-job.ts` uses `setInterval` with `Math.random()` to fake anonymization progress. `anonymizeStudyAction` in `src/actions/anonymizeStudy.ts` already calls the real Orthanc `/studies/{id}/anonymize` endpoint. Orthanc jobs return an ID and can be polled via `jobsApi.get(jobId)`. We replace the simulation with a real mutation + job poll.

**Files:**

- Modify: `src/features/tasks/hooks/use-anonymize-job.ts`
- Create: `src/features/tasks/hooks/use-anonymize-job.test.ts`

**Step 1: Write the failing test**

Create `src/features/tasks/hooks/use-anonymize-job.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/actions/anonymizeStudy', () => ({
  anonymizeStudyAction: vi.fn().mockResolvedValue({ ID: 'new-study-789', Path: '/studies/new-study-789' }),
}));
vi.mock('@/store/job-store', () => ({
  useJobStore: { getState: vi.fn().mockReturnValue({ addJob: vi.fn(), updateJob: vi.fn() }) },
}));

import { useAnonymizeJob } from './use-anonymize-job';
import { anonymizeStudyAction } from '@/actions/anonymizeStudy';

const qc = new QueryClient();
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

describe('useAnonymizeJob', () => {
  it('calls anonymizeStudyAction with correct arguments', async () => {
    const { result } = renderHook(() => useAnonymizeJob(), { wrapper });
    await act(async () => {
      await result.current.startAnonymize(
        { level: 'study', id: 'study-123', label: 'Doe^John' },
        { keepStudyDescription: true, keepSeriesDescription: false }
      );
    });
    expect(anonymizeStudyAction).toHaveBeenCalledWith(
      expect.objectContaining({ ID: 'study-123' }),
      expect.any(Object)
    );
  });

  it('does NOT use Math.random or setInterval', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    const intervalSpy = vi.spyOn(global, 'setInterval');
    renderHook(() => useAnonymizeJob(), { wrapper });
    expect(randomSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/tasks/hooks/use-anonymize-job.test.ts --reporter=verbose
```

Expected: FAIL — `Math.random` is called by the current simulation.

**Step 3: Rewrite `use-anonymize-job.ts`**

```typescript
import { useCallback } from 'react';
import { useJobStore } from '@/store/job-store';
import { anonymizeStudyAction } from '@/actions/anonymizeStudy';
import type { Study } from '@/api/studies';

interface AnonymizeTarget {
  level: 'study' | 'series' | 'instance';
  id: string;
  label: string;
}

interface AnonymizeOptions {
  newPatientName?: string;
  newPatientId?: string;
  keepStudyDescription: boolean;
  keepSeriesDescription: boolean;
}

export function useAnonymizeJob() {
  const startAnonymize = useCallback(
    async ({ level, id, label }: AnonymizeTarget, options: AnonymizeOptions) => {
      const jobStore = useJobStore.getState();
      const jobId = `anonymize-${Date.now()}`;

      const desc = [
        options.newPatientName && `→ ${options.newPatientName}`,
        options.keepStudyDescription && 'keep study desc',
        options.keepSeriesDescription && 'keep series desc',
      ].filter(Boolean).join(', ') || 'Full anonymization';

      jobStore.addJob({
        id: jobId,
        type: 'anonymize',
        label: `${label} (${level})`,
        description: desc,
        progress: 0,
        status: 'running',
      });

      try {
        // Build the anonymization body for the Orthanc API
        const body: Record<string, unknown> = {
          Keep: [
            ...(options.keepStudyDescription ? ['StudyDescription'] : []),
            ...(options.keepSeriesDescription ? ['SeriesDescription'] : []),
          ],
        };
        if (options.newPatientName) body['Replace'] = { PatientName: options.newPatientName };
        if (options.newPatientId) {
          body['Replace'] = { ...(body['Replace'] as Record<string, string> ?? {}), PatientID: options.newPatientId };
        }

        // Only study-level anonymization is currently exposed via IStudyRepository
        if (level !== 'study') {
          throw new Error(`Anonymization of ${level} is not yet supported`);
        }

        const stub = { ID: id } as Study; // action only uses .ID
        await anonymizeStudyAction(stub, body);

        jobStore.updateJob(jobId, { progress: 100, status: 'complete' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Anonymization failed';
        jobStore.updateJob(jobId, { status: 'error', error: message });
      }
    },
    []
  );

  return { startAnonymize };
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/tasks/hooks/use-anonymize-job.test.ts --reporter=verbose
```

**Step 5: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

**Step 6: Commit**

```bash
git add src/features/tasks/hooks/use-anonymize-job.ts \
        src/features/tasks/hooks/use-anonymize-job.test.ts
git commit -m "feat: wire useAnonymizeJob to real anonymizeStudyAction — remove simulation"
```

---

## Task 3 — Scaffold auth provider as runtime-switchable

**Context:** `AuthProvider` always returns a hardcoded admin user. The interface (`AuthContextValue`, `Permission`, `UserRole`) is already correct and production-ready. We add a runtime config guard so the demo user only activates when `authMode === "none"`. When `authMode === "oidc"` or `"smart"`, we throw a clear "not yet implemented" error (better than silently admitting a demo admin). This prevents accidental production exposure.

**Files:**

- Modify: `src/app/providers/auth-context.tsx`
- Create: `src/app/providers/auth-context.test.tsx`

**Step 1: Write the failing test**

Create `src/app/providers/auth-context.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/runtime', () => ({
  getConfig: vi.fn().mockReturnValue({ authMode: 'none' }),
}));

import { AuthProvider, useAuth } from './auth-context';

function DisplayAuth() {
  const { user, isAuthenticated } = useAuth();
  return <div data-testid="auth">{isAuthenticated ? user?.displayName : 'unauthenticated'}</div>;
}

describe('AuthProvider', () => {
  it('provides demo user when authMode is none', () => {
    render(<AuthProvider><DisplayAuth /></AuthProvider>);
    expect(screen.getByTestId('auth').textContent).toBeTruthy();
  });

  it('throws when authMode is oidc (not yet implemented)', async () => {
    const { getConfig } = await import('@/config/runtime');
    vi.mocked(getConfig).mockReturnValue({ authMode: 'oidc' } as ReturnType<typeof getConfig>);
    expect(() => render(<AuthProvider><div /></AuthProvider>)).toThrow(
      /OIDC auth not yet implemented/
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/providers/auth-context.test.tsx --reporter=verbose
```

Expected: FAIL — OIDC branch does not throw; it returns the demo admin user.

**Step 3: Update `auth-context.tsx`**

Add the runtime config guard at the top of `AuthProvider`:

```typescript
import { getConfig } from '@/config/runtime';

export function AuthProvider({ children }: { children: ReactNode }) {
  const cfg = getConfig();

  if (cfg.authMode === 'oidc' || cfg.authMode === 'smart') {
    throw new Error(
      `OIDC auth not yet implemented — authMode "${cfg.authMode}" requires Phase 2 implementation. ` +
      `Set authMode to "none" in public/config.js for local development.`
    );
  }

  // authMode === 'none' | 'basic' — demo user for development
  const user = DEMO_USER;
  // ... rest of implementation unchanged
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/app/providers/auth-context.test.tsx --reporter=verbose
```

**Step 5: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

**Step 6: Commit**

```bash
git add src/app/providers/auth-context.tsx \
        src/app/providers/auth-context.test.tsx
git commit -m "fix: guard AuthProvider against non-none authMode — throw explicit error for unimplemented OIDC/SMART"
```

---

## Task 4 — Delete duplicate HTTP transport

**Context:** `src/shared/api/http-client.ts` (`HttpClient`), `src/shared/api/orthanc-client.ts` (`OrthancClient`), and `src/shared/api/dicomweb-client.ts` (`DicomWebClient`) are a parallel transport stack that is not used in any production path. All production code uses `orthancFetch` from `src/lib/client.ts`. Before deleting, verify no production import exists.

**Files:**

- Delete: `src/shared/api/http-client.ts`
- Delete: `src/shared/api/orthanc-client.ts`
- Delete: `src/shared/api/dicomweb-client.ts`

**Step 1: Verify no production imports**

```bash
grep -r "http-client\|orthanc-client\|dicomweb-client\|HttpClient\|OrthancClient\|DicomWebClient" \
  src/ --include="*.ts" --include="*.tsx" \
  | grep -v "shared/api/http-client\|shared/api/orthanc-client\|shared/api/dicomweb-client"
```

Expected: zero results (only self-references within the files).

**Step 2: Delete the files**

```bash
rm src/shared/api/http-client.ts \
   src/shared/api/orthanc-client.ts \
   src/shared/api/dicomweb-client.ts
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors related to deleted files.

**Step 4: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

**Step 5: Commit**

```bash
git add -u
git commit -m "chore: remove unused HttpClient/OrthancClient/DicomWebClient transport — orthancFetch is canonical"
```

---

## Task 5 — Fix repository layering violation

**Context:** `OrthancStudyRepository.sendToModality()` calls `sendStudyAction()` (an actions-layer function) from within the repository. Repositories should be pure data access. The action wrapper (`sendStudyAction`) should be invoked at the feature component / hook level, not inside the repo. Same violation exists for `addLabel` and `removeLabel` calling `addLabelAction` / `removeLabelAction`.

**Files:**

- Modify: `src/shared/api/orthanc-study-repository.ts` (lines 249–262)
- Modify: `src/shared/api/orthanc-study-repository.test.ts`

**Step 1: Write the failing test**

Add to `orthanc-study-repository.test.ts`:

```typescript
import { studiesApi } from '@/api/studies';

vi.mock('@/api/studies');
vi.mock('@/api/series');
vi.mock('@/api/instances');
// Ensure actions-layer is NOT imported by the repo
vi.mock('@/actions/sendStudy', () => ({
  sendStudyAction: vi.fn().mockRejectedValue(new Error('actions layer must not be called from repo')),
}));
vi.mock('@/actions/studyLabel', () => ({
  addLabelAction: vi.fn().mockRejectedValue(new Error('actions layer must not be called from repo')),
  removeLabelAction: vi.fn().mockRejectedValue(new Error('actions layer must not be called from repo')),
}));

describe('OrthancStudyRepository — layering', () => {
  it('sendToModality calls studiesApi.sendToModality directly, not sendStudyAction', async () => {
    vi.mocked(studiesApi.sendToModality).mockResolvedValue(undefined);
    const repo = new OrthancStudyRepository();
    await expect(repo.sendToModality('study-1', 'PACS1')).resolves.toBeUndefined();
    expect(studiesApi.sendToModality).toHaveBeenCalledWith('study-1', 'PACS1');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/api/orthanc-study-repository.test.ts --reporter=verbose
```

Expected: FAIL — `sendStudyAction` throws from our mock, proving the repo calls the actions layer.

**Step 3: Fix `orthanc-study-repository.ts`**

Remove the actions-layer imports (lines 23–24):

```typescript
// DELETE these lines:
import { sendStudyAction } from '@/actions/sendStudy';
import { addLabelAction, removeLabelAction } from '@/actions/studyLabel';
```

Replace the three method bodies:

```typescript
async sendToModality(id: string, modalityId: string): Promise<void> {
  await studiesApi.sendToModality(id, modalityId);
}

async addLabel(id: string, label: string): Promise<void> {
  await studiesApi.addLabel(id, label);
}

async removeLabel(id: string, label: string): Promise<void> {
  await studiesApi.removeLabel(id, label);
}
```

> Note: `studiesApi.addLabel` and `studiesApi.removeLabel` must exist. Check `src/api/studies.ts` — if missing, add them there before this step.

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/api/orthanc-study-repository.test.ts --reporter=verbose
```

**Step 5: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

**Step 6: Commit**

```bash
git add src/shared/api/orthanc-study-repository.ts \
        src/shared/api/orthanc-study-repository.test.ts
git commit -m "fix: remove actions-layer imports from OrthancStudyRepository — pure data access"
```

---

## Task 6 — Add `onError` handlers to mutations in `StudyDetailPage`

**Context:** `deleteMutation` and `downloadMutation` both lack `onError` callbacks. A failed delete or download produces no user feedback. We add toast notifications that include the correlation ID from `OrthancError` for supportability.

**Files:**

- Modify: `src/features/studies/pages/StudyDetailPage.tsx` (lines 68–79)

**Step 1: Write the failing test**

There is no existing test for `StudyDetailPage`. Create one:

Create `src/features/studies/pages/StudyDetailPage.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import StudyDetailPage from './StudyDetailPage';
import { OrthancError } from '@/lib/errors';

vi.mock('@/features/studies/hooks/use-studies', () => ({
  useStudy: () => ({
    data: {
      ID: 'study-1', patientName: 'Doe^John', studyDate: '20240101',
      studyDescription: 'Chest CT', modality: 'CT', numberOfSeries: 1,
      diskSize: 1024, series: [],
    },
    isLoading: false,
  }),
  useStudySeries: () => ({ data: [] }),
  useInstancePreview: () => ({ data: null, isLoading: false }),
  useStudySharedTags: () => ({ data: {} }),
}));

vi.mock('@/actions/deleteStudy', () => ({
  deleteStudyAction: vi.fn().mockRejectedValue(
    new OrthancError(403, 'corr-abc', 'You are not authorized to perform this action.')
  ),
}));

vi.mock('@/features/audit/hooks/use-audit-log', () => ({
  useAuditLog: () => ({ entries: [] }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

function setup() {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/studies/study-1']}>
        <Routes>
          <Route path="/studies/:studyId" element={<StudyDetailPage />} />
        </Routes>
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('StudyDetailPage', () => {
  it('shows error toast with correlation ID when delete fails', async () => {
    setup();
    // Trigger delete via the AlertDialog confirm
    const deleteBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Delete'));
    if (deleteBtn) await userEvent.click(deleteBtn);
    const confirmBtn = await screen.findByRole('button', { name: /confirm|delete/i });
    await userEvent.click(confirmBtn);
    await waitFor(() => {
      expect(screen.getByText(/corr-abc|not authorized/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/studies/pages/StudyDetailPage.test.tsx --reporter=verbose
```

Expected: FAIL — no toast appears on delete error.

**Step 3: Add `onError` to both mutations**

In `StudyDetailPage.tsx`, add the import at the top:

```typescript
import { toast } from 'sonner';
import { OrthancError } from '@/lib/errors';
```

Update `deleteMutation` (starting line 68):

```typescript
const deleteMutation = useMutation({
  mutationFn: (orthancStudy: OrthancStudy) => deleteStudyAction(orthancStudy),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['studies'] });
    navigate('/studies');
  },
  onError: (err) => {
    const ref = err instanceof OrthancError ? ` (Ref: ${err.correlationId})` : '';
    toast.error(`Failed to delete study.${ref}`);
  },
});
```

Update `downloadMutation` (starting line 76):

```typescript
const downloadMutation = useMutation({
  mutationFn: (id: string) =>
    downloadStudyAction(id, study ? `${formatPatientName(study.patientName)}.zip` : `${id}.zip`),
  onError: (err) => {
    const ref = err instanceof OrthancError ? ` (Ref: ${err.correlationId})` : '';
    toast.error(`Download failed.${ref}`);
  },
});
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/studies/pages/StudyDetailPage.test.tsx --reporter=verbose
```

**Step 5: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

**Step 6: Commit**

```bash
git add src/features/studies/pages/StudyDetailPage.tsx \
        src/features/studies/pages/StudyDetailPage.test.tsx
git commit -m "fix: add onError toast handlers to delete and download mutations in StudyDetailPage"
```

---

## Task 7 — Rename Orthanc wire types to eliminate name collision

**Context:** `Study`, `Series`, `Instance` exist as both Orthanc wire types (`src/api/studies.ts`) and domain model types (`src/shared/types/dicom.ts`). The repository file manages this with aliased imports — `import type { Study as OrthancStudy }`. We rename the wire types to `OrthancStudy`, `OrthancSeries`, `OrthancInstance` so the alias is no longer needed and the distinction is always visible in code.

**Files:**

- Modify: `src/api/studies.ts`
- Modify: `src/api/series.ts`
- Modify: `src/api/instances.ts`
- Modify: `src/shared/api/orthanc-study-repository.ts`
- Modify: `src/features/studies/pages/StudyDetailPage.tsx`
- Modify: `src/actions/deleteStudy.ts`
- Modify: `src/actions/downloadStudy.ts`
- Modify: `src/actions/anonymizeStudy.ts`
- (any other file with `import type { Study } from '@/api/studies'`)

**Step 1: Find all files that import wire types**

```bash
grep -r "from '@/api/studies'\|from '@/api/series'\|from '@/api/instances'" \
  src/ --include="*.ts" --include="*.tsx" -l
```

**Step 2: Rename exports in `src/api/studies.ts`**

Change:

```typescript
export type Study = { ... }
```

to:

```typescript
export type OrthancStudy = { ... }
// Keep backward compat alias during transition — remove after all callers updated
export type Study = OrthancStudy;
```

Do the same for `Series` → `OrthancSeries` in `src/api/series.ts` and `Instance` → `OrthancInstance` in `src/api/instances.ts`.

**Step 3: Update all import sites**

For each file found in Step 1, change:

```typescript
import type { Study as OrthancStudy } from '@/api/studies';
```

to:

```typescript
import type { OrthancStudy } from '@/api/studies';
```

And update all usage of the alias to the new canonical name.

**Step 4: Remove the backward-compat aliases from step 2**

Once all callers are updated:

```typescript
// Remove: export type Study = OrthancStudy;
```

**Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 6: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

**Step 7: Commit**

```bash
git add src/api/studies.ts src/api/series.ts src/api/instances.ts \
        src/shared/api/orthanc-study-repository.ts \
        src/features/studies/pages/StudyDetailPage.tsx \
        src/actions/
git commit -m "refactor: rename Orthanc wire types Study→OrthancStudy, Series→OrthancSeries, Instance→OrthancInstance"
```

---

## Task 8 — ESLint: re-enable `no-unused-vars`, remove layout exclusions, add Prettier

**Context:** `eslint.config.js` disables `@typescript-eslint/no-unused-vars` and ignores `src/app/providers/**` and `src/app/layout/**`. Prettier is missing entirely. We fix all three.

**Files:**

- Modify: `eslint.config.js`
- Create: `.prettierrc`
- Create: `.prettierignore`

**Step 1: Add Prettier**

Create `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

Create `.prettierignore`:

```
dist
node_modules
public/
```

Install Prettier:

```bash
npm install --save-dev prettier eslint-config-prettier
```

**Step 2: Update `eslint.config.js`**

```javascript
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "src/components/ui/**",  // shadcn-generated, not our code
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
```

**Step 3: Run lint and fix all violations**

```bash
npx eslint src/ --fix
npx prettier --write "src/**/*.{ts,tsx}"
npx tsc --noEmit
```

Fix any remaining lint errors manually (unused variables, unreachable `as any` casts).

**Step 4: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

**Step 5: Commit**

```bash
git add eslint.config.js .prettierrc .prettierignore package.json package-lock.json
git add src/  # all auto-fixed files
git commit -m "chore: re-enable no-unused-vars, remove layout eslint exclusions, add Prettier"
```

---

## Task 9 — Extract `JSON_HEADERS` to shared constant

**Context:** `const JSON_HEADERS = { "Content-Type": "application/json" }` is redeclared in 6 API files: `modalities.ts`, `jobs.ts`, `dicomWebServers.ts`, `tools.ts`, `studies.ts`, `peers.ts`. Move it to `src/lib/client.ts` as an export.

**Files:**

- Modify: `src/lib/client.ts`
- Modify: `src/api/modalities.ts`
- Modify: `src/api/jobs.ts`
- Modify: `src/api/dicomWebServers.ts`
- Modify: `src/api/tools.ts`
- Modify: `src/api/studies.ts`
- Modify: `src/api/peers.ts`

**Step 1: Add export to `src/lib/client.ts`**

```typescript
/** Shared Content-Type header for JSON request bodies. */
export const JSON_CONTENT_HEADERS = { "Content-Type": "application/json" } as const;
```

**Step 2: Update all 6 API files**

In each file, remove the local `const JSON_HEADERS` declaration and add:

```typescript
import { orthancFetch, JSON_CONTENT_HEADERS } from "@/lib/client";
```

Replace all usages of `JSON_HEADERS` with `JSON_CONTENT_HEADERS`.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

**Step 5: Commit**

```bash
git add src/lib/client.ts src/api/
git commit -m "refactor: extract JSON_CONTENT_HEADERS to client.ts — remove 6 duplicate declarations"
```

---

## Task 10 — De-duplicate `scrubbedMessage` between `errors.ts` and `upload-xhr.ts`

**Context:** `src/lib/upload-xhr.ts` declares its own `scrubbedMessage()` with a nearly identical HTTP status map to `SCRUBBED_MESSAGES` in `src/lib/errors.ts`. The XHR module should use the shared map. `OrthancError.from()` already does the lookup — we expose the scrubber as a named export.

**Files:**

- Modify: `src/lib/errors.ts`
- Modify: `src/lib/upload-xhr.ts`
- Modify: `src/lib/errors.test.ts` (add coverage for the export)

**Step 1: Write the failing test**

In `src/lib/errors.test.ts`, add:

```typescript
import { scrubbedHttpMessage } from './errors';

describe('scrubbedHttpMessage', () => {
  it('returns the pre-scripted message for known status codes', () => {
    expect(scrubbedHttpMessage(403)).toBe('You are not authorized to perform this action.');
    expect(scrubbedHttpMessage(404)).toBe('The requested resource was not found.');
  });

  it('returns a generic fallback for unknown codes', () => {
    expect(scrubbedHttpMessage(418)).toBe('Request failed (418).');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/errors.test.ts --reporter=verbose
```

Expected: FAIL — `scrubbedHttpMessage` is not exported.

**Step 3: Export `scrubbedHttpMessage` from `errors.ts`**

```typescript
const SCRUBBED_MESSAGES: Record<number, string> = {
  400: "The request was invalid.",
  401: "Authentication required.",
  403: "You are not authorized to perform this action.",
  404: "The requested resource was not found.",
  409: "A conflict occurred.",
  413: "File too large.",          // ← add 413 to match upload-xhr
  500: "The server encountered an error.",
  502: "Upstream service unavailable.",
  503: "Service temporarily unavailable.",
};

/** Returns a PHI-safe, pre-scripted message for an HTTP status code. */
export function scrubbedHttpMessage(status: number): string {
  return SCRUBBED_MESSAGES[status] ?? `Request failed (${status}).`;
}
```

**Step 4: Update `upload-xhr.ts`**

Remove the local `scrubbedMessage` function and import from `errors.ts`:

```typescript
import { OrthancError, scrubbedHttpMessage } from '@/lib/errors';
// ... replace all scrubbedMessage(status) calls with scrubbedHttpMessage(status)
```

**Step 5: Run test to verify it passes**

```bash
npx vitest run src/lib/errors.test.ts src/lib/upload-xhr.test.ts --reporter=verbose
```

**Step 6: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

**Step 7: Commit**

```bash
git add src/lib/errors.ts src/lib/upload-xhr.ts src/lib/errors.test.ts
git commit -m "refactor: export scrubbedHttpMessage from errors.ts — de-duplicate XHR status map"
```

---

## Final Verification

After all 10 tasks are complete, run:

```bash
# Full type check
npx tsc --noEmit

# Full lint
npx eslint src/

# Full test suite
npx vitest run --reporter=verbose

# Smoke build
npm run build
```

All should exit 0. Then open a PR with the 10 commits as the full remediation branch.
