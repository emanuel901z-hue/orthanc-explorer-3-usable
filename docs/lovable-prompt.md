# Lovable.dev Prompt: Orthanc Explorer 3 - Modern DICOM Management UI

## Project Overview

Build **Orthanc Explorer 3**, a modern enterprise-grade React SPA for managing medical imaging (DICOM) data. This is an admin/management interface for the Orthanc DICOM server, treating Orthanc as a headless backend via its REST API.

**Critical Context:** This UI manages DICOM studies (medical imaging exams), series (image sequences), and instances (individual images). Think "file explorer for medical images" with search, batch operations, and remote connectivity.

---

## Tech Stack Requirements

- **Framework:** React 18+ with TypeScript (strict mode)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Component Library:** shadcn/ui (accessible, composable components)
- **Routing:** React Router v6 with nested routes and URL state management
- **State Management:** Zustand (global app state)
- **Data Fetching:** TanStack Query (React Query) for API state management
- **Tables:** TanStack Table with virtual scrolling
- **Forms:** React Hook Form with Zod validation
- **Icons:** Lucide React
- **Date Handling:** date-fns

---

## Architecture Requirements

### Enterprise Architecture Pattern

Implement a **Domain-Driven Design (DDD)** architecture with clear separation of concerns:

```text
src/
├── app/                          # Application layer
│   ├── router/                   # React Router setup
│   └── providers/                # Context providers
├── domain/                       # Domain layer (business logic)
│   ├── models/                   # Domain entities & types
│   │   ├── study.ts
│   │   ├── series.ts
│   │   ├── instance.ts
│   │   ├── modality.ts
│   │   └── dicomweb-server.ts
│   └── services/                 # Business logic services
│       ├── study-service.ts
│       ├── upload-service.ts
│       └── dicom-tag-service.ts
├── infrastructure/               # Infrastructure layer
│   ├── repositories/             # Data access abstraction
│   │   ├── interfaces/
│   │   │   ├── study-repository.interface.ts
│   │   │   ├── series-repository.interface.ts
│   │   │   └── modality-repository.interface.ts
│   │   ├── demo/                 # Demo data implementations
│   │   │   ├── demo-study-repository.ts
│   │   │   └── demo-data-generator.ts
│   │   └── orthanc/              # Real Orthanc implementations (stubs for now)
│   │       └── orthanc-study-repository.ts
│   ├── api/                      # API client setup
│   │   └── orthanc-client.ts
│   └── config/                   # Configuration
│       └── repository-factory.ts # DI container for repositories
├── presentation/                 # Presentation layer
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── data-table/           # TanStack Table wrappers
│   │   ├── forms/                # Form components
│   │   └── layouts/              # Layout components
│   ├── pages/                    # Route pages
│   │   ├── studies/
│   │   ├── upload/
│   │   ├── remote-sources/
│   │   └── settings/
│   ├── features/                 # Feature-specific components
│   │   ├── study-list/
│   │   ├── study-detail/
│   │   └── modality-management/
│   └── hooks/                    # Custom React hooks
│       ├── use-studies.ts
│       └── use-upload.ts
└── store/                        # Zustand stores
    ├── auth-store.ts
    ├── ui-store.ts
    └── preferences-store.ts
```

### Repository Pattern with Dependency Injection

**Critical Requirement:** All data access MUST go through repository interfaces. This allows swapping demo data with real Orthanc API calls without changing any business logic.

Example structure:

```typescript
// infrastructure/repositories/interfaces/study-repository.interface.ts
export interface IStudyRepository {
  findAll(filters?: StudyFilters): Promise<Study[]>;
  findById(id: string): Promise<Study>;
  delete(id: string): Promise<void>;
  modify(id: string, modifications: DicomModifications): Promise<Study>;
  anonymize(id: string, config: AnonymizationConfig): Promise<Study>;
  sendToModality(id: string, modalityId: string): Promise<void>;
}

// infrastructure/repositories/demo/demo-study-repository.ts
export class DemoStudyRepository implements IStudyRepository {
  private studies: Study[] = generateDemoStudies(100);

  async findAll(filters?: StudyFilters): Promise<Study[]> {
    // Filter in-memory demo data
    return this.studies.filter(/* filtering logic */);
  }
  // ... other methods with in-memory operations
}

// infrastructure/repositories/orthanc/orthanc-study-repository.ts
export class OrthancStudyRepository implements IStudyRepository {
  constructor(private client: OrthancApiClient) {}

  async findAll(filters?: StudyFilters): Promise<Study[]> {
    // Real API call to Orthanc /tools/find
    const response = await this.client.post('/tools/find', {
      Level: 'Study',
      Query: buildQuery(filters)
    });
    return response.map(mapToStudyModel);
  }
  // ... other methods with real API calls
}

// infrastructure/config/repository-factory.ts
export class RepositoryFactory {
  private static useDemoData = true; // Toggle for demo vs real

  static createStudyRepository(): IStudyRepository {
    if (this.useDemoData) {
      return new DemoStudyRepository();
    }
    return new OrthancStudyRepository(orthancClient);
  }
}

// domain/services/study-service.ts
export class StudyService {
  constructor(private studyRepo: IStudyRepository) {}

  async searchStudies(filters: StudyFilters): Promise<Study[]> {
    // Business logic layer - works with ANY repository implementation
    const studies = await this.studyRepo.findAll(filters);
    return studies.sort((a, b) => b.studyDate.getTime() - a.studyDate.getTime());
  }
}

// presentation/hooks/use-studies.ts
export function useStudies(filters: StudyFilters) {
  const studyRepo = RepositoryFactory.createStudyRepository();
  const studyService = new StudyService(studyRepo);

  return useQuery({
    queryKey: ['studies', filters],
    queryFn: () => studyService.searchStudies(filters)
  });
}
```

---

## Domain Models

Define these TypeScript interfaces in `domain/models/`:

```typescript
// study.ts
export interface Study {
  id: string;                    // Orthanc internal ID
  patientId: string;
  patientName: string;
  patientBirthDate?: Date;
  patientSex?: 'M' | 'F' | 'O';
  studyInstanceUID: string;      // DICOM UID
  studyDate: Date;
  studyTime?: string;
  studyDescription?: string;
  accessionNumber?: string;
  modalities: string[];          // ['CT', 'MR', 'US']
  numberOfSeries: number;
  numberOfInstances: number;
  diskSize?: number;             // bytes
  labels?: string[];             // User-assigned labels
  isStable: boolean;             // False during upload
  lastUpdate: Date;
}

// series.ts
export interface Series {
  id: string;
  seriesInstanceUID: string;
  seriesNumber: number;
  seriesDescription?: string;
  modality: string;
  numberOfInstances: number;
  instances: Instance[];
}

// instance.ts
export interface Instance {
  id: string;
  sopInstanceUID: string;
  instanceNumber: number;
  fileSize: number;
  tags: DicomTag[];
}

// modality.ts
export interface DicomModality {
  id: string;
  name: string;
  aet: string;                   // Application Entity Title
  host: string;
  port: number;
  manufacturer?: string;
  lastEcho?: Date;
  lastEchoStatus?: 'success' | 'failure';
}

// dicomweb-server.ts
export interface DicomWebServer {
  id: string;
  name: string;
  url: string;
  authType: 'none' | 'basic' | 'bearer';
  username?: string;
  hasQidoSupport: boolean;
  hasWadoSupport: boolean;
  hasStowSupport: boolean;
}
```

---

## Demo Data Generation

Create realistic, structured demo data in `infrastructure/repositories/demo/demo-data-generator.ts`:

```typescript
export function generateDemoStudies(count: number): Study[] {
  const patients = generatePatients(20); // 20 patients
  const modalities = ['CT', 'MR', 'US', 'CR', 'DX', 'PT', 'NM'];
  const bodyParts = ['CHEST', 'ABDOMEN', 'HEAD', 'PELVIS', 'SPINE'];

  return Array.from({ length: count }, (_, i) => {
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const modality = modalities[Math.floor(Math.random() * modalities.length)];
    const bodyPart = bodyParts[Math.floor(Math.random() * bodyParts.length)];

    return {
      id: `demo-study-${i}`,
      patientId: patient.id,
      patientName: patient.name,
      patientBirthDate: patient.birthDate,
      patientSex: patient.sex,
      studyInstanceUID: `1.2.840.${Math.random().toString().slice(2)}`,
      studyDate: subDays(new Date(), Math.floor(Math.random() * 365)),
      studyDescription: `${modality} ${bodyPart}`,
      accessionNumber: `ACC${String(i).padStart(8, '0')}`,
      modalities: [modality],
      numberOfSeries: Math.floor(Math.random() * 5) + 1,
      numberOfInstances: Math.floor(Math.random() * 100) + 20,
      diskSize: Math.floor(Math.random() * 500000000) + 10000000,
      labels: Math.random() > 0.7 ? [['Urgent', 'Reviewed', 'Exported'][Math.floor(Math.random() * 3)]] : [],
      isStable: true,
      lastUpdate: new Date()
    };
  });
}

function generatePatients(count: number): Array<{ id: string; name: string; birthDate: Date; sex: 'M' | 'F' }> {
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

  return Array.from({ length: count }, (_, i) => ({
    id: `PAT${String(i).padStart(6, '0')}`,
    name: `${lastNames[i % lastNames.length]}^${firstNames[i % firstNames.length]}`,
    birthDate: subYears(new Date(), Math.floor(Math.random() * 80) + 20),
    sex: Math.random() > 0.5 ? 'M' : 'F'
  }));
}
```

---

## Application Screens

### 1. Layout & Navigation

**App Shell with Sidebar Navigation:**

- Logo and app title at top
- Collapsible sidebar with icons + labels
- Navigation items:
  - 🏠 Dashboard (future)
  - 📚 Studies (main view)
  - ⬆️ Upload
  - 🌐 Remote Sources
  - ⚙️ Settings
- User menu in bottom corner (auth status, theme toggle)
- Dark/light theme support with system detection
- Responsive: collapsible sidebar on mobile

### 2. Study List Page (`/studies`)

**Main Features:**

- **Search Bar** at top with filters:
  - Patient Name
  - Patient ID
  - Study Date range picker (presets: Today, Last 7 days, Last 30 days, Custom)
  - Accession Number
  - Study Description
  - Modality (multi-select)
- **Data Table** (TanStack Table with virtual scrolling):
  - Columns: Patient Name, Patient ID, Study Date, Modality, Description, Series Count, Status, Actions
  - Row selection (checkboxes)
  - Sortable columns
  - Resizable columns
  - Pagination info (showing X-Y of Z)
- **Bulk Actions Bar** (appears when rows selected):
  - Export, Delete, Add Label, Send to Modality
- **Keyboard Shortcuts:**
  - `/` to focus search
  - `Cmd+K` for command palette (future)
  - Arrow keys to navigate
  - Enter to open study detail
  - Space to select row

**State Management:**

- Search filters in URL query params (shareable links)
- Column preferences in localStorage
- Selected rows in component state

### 3. Study Detail Page (`/studies/:id`)

**Layout:** Two-column layout

- **Left Column (Study Metadata):**
  - Patient info card (name, ID, birthdate, sex)
  - Study info card (date, time, description, accession #)
  - Study statistics (series count, instances, disk size)
  - Labels (editable chips)
  - Action buttons: Open in Viewer, Modify, Anonymize, Delete, Send, Download ZIP

- **Right Column (Series List):**
  - Card grid of series with:
    - Series thumbnail (placeholder image for demo)
    - Series number, modality, description
    - Instance count
    - Click to expand instance list

**Tabs:**

- Overview (default)
- DICOM Tags (searchable tag browser)
- Activity Log (timestamps for received, accessed, modified)

### 4. Upload Page (`/upload`)

**Features:**

- Drag-and-drop zone (large, centered)
- File picker button
- Upload queue table:
  - File name, size, progress bar, status, actions
  - Support pause/resume/cancel per file
- Overall progress indicator at top
- Upload report on completion (success count, failures with reasons)

**State:**

- Upload queue in Zustand store
- Mock upload progress with setTimeout for demo

### 5. Remote Sources Page (`/remote-sources`)

**Tabs:**

- **DICOM Query/Retrieve**
  - Modality selector dropdown
  - Search form (similar to study list)
  - Results table with Retrieve button per study

- **DICOMweb Browser**
  - Server selector dropdown
  - Search form
  - Results table with Retrieve button

**Connection Status:** Display AET, host, port, last echo status for each modality

### 6. Settings Page (`/settings`)

**Tabs:**

- **System Info**
  - Orthanc version, disk usage, database stats (demo data)

- **Modalities**
  - Table of DICOM modalities with Add/Edit/Delete/Test Echo actions
  - Form modal for add/edit with fields: Name, AET, Host, Port, Manufacturer

- **DICOMweb Servers**
  - Table with Add/Edit/Delete/Test Connection actions

- **Viewer Integration**
  - Configure viewer URLs (OHIF, Stone Viewer, Weasis)

- **Preferences**
  - Theme selector (light/dark/system)
  - Default search mode
  - Column visibility toggles
  - Custom logo upload (future)

---

## Routing Structure

```typescript
// app/router/routes.tsx
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/studies" replace /> },
      {
        path: 'studies',
        children: [
          { index: true, element: <StudyListPage /> },
          { path: ':studyId', element: <StudyDetailPage /> }
        ]
      },
      { path: 'upload', element: <UploadPage /> },
      {
        path: 'remote-sources',
        element: <RemoteSourcesPage />,
        children: [
          { index: true, element: <Navigate to="dicom" replace /> },
          { path: 'dicom', element: <DicomQueryRetrievePage /> },
          { path: 'dicomweb', element: <DicomWebBrowserPage /> }
        ]
      },
      {
        path: 'settings',
        element: <SettingsPage />,
        children: [
          { index: true, element: <Navigate to="system" replace /> },
          { path: 'system', element: <SystemInfoTab /> },
          { path: 'modalities', element: <ModalitiesTab /> },
          { path: 'dicomweb', element: <DicomWebServersTab /> },
          { path: 'viewer', element: <ViewerIntegrationTab /> },
          { path: 'preferences', element: <PreferencesTab /> }
        ]
      }
    ]
  }
]);
```

---

## Zustand Store Structure

```typescript
// store/ui-store.ts
interface UiState {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
}

// store/preferences-store.ts
interface PreferencesState {
  studyListColumns: string[];
  defaultDateRange: 'today' | 'week' | 'month';
  viewerUrl: string;
  setStudyListColumns: (columns: string[]) => void;
  // ... other setters
}

// store/upload-store.ts
interface UploadState {
  queue: UploadItem[];
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  updateProgress: (id: string, progress: number) => void;
  // ... other upload actions
}
```

---

## Key UX Patterns

### Command Palette (Future Enhancement)

- Cmd+K to open
- Search studies, navigate to pages, run actions
- Built with Radix UI Command component

### Toast Notifications

- Success/error/info toasts for actions
- Use shadcn/ui Sonner component

### Confirmation Modals

- Delete confirmations with checkboxes for "also delete on disk"
- Batch operation warnings

### Loading States

- Skeleton loaders for tables during initial load
- Spinner overlays for actions
- Optimistic updates with TanStack Query

### Error Handling

- Error boundaries for component crashes
- Inline error messages in forms
- Toast notifications for API errors
- Retry buttons for failed operations

---

## Styling Guidelines

**Tailwind Configuration:**

- Custom color palette for healthcare context (calming blues/greens, not aggressive reds)
- Dark mode with `class` strategy
- Custom spacing for medical data density

**Component Style:**

- Clean, spacious layouts (healthcare users = less tech-savvy)
- Large click targets (min 44x44px)
- High contrast text for readability
- Consistent spacing (use Tailwind spacing scale)

**Typography:**

- Use Inter font (modern, readable)
- DICOM UIDs in monospace font
- Patient names in slightly larger, bold font
- Dates in consistent format (use date-fns)

---

## Accessibility Requirements

- WCAG 2.1 AA compliance
- Semantic HTML (proper headings, landmarks)
- Keyboard navigation for all interactions
- Focus management (trap focus in modals)
- Screen reader labels on icon buttons
- Color contrast ratios (4.5:1 for text)
- Skip to main content link

---

## Performance Considerations

- Virtual scrolling for study list (TanStack Table + `@tanstack/react-virtual`)
- Lazy loading for series thumbnails
- Debounced search inputs (300ms)
- Pagination for large datasets (client-side for demo)
- Memoization for expensive computations
- Code splitting by route

---

## Environment Configuration

Use Vite environment variables:

```typescript
// src/infrastructure/config/env.ts
export const config = {
  orthancUrl: import.meta.env.VITE_ORTHANC_URL || 'http://localhost:8042',
  useDemoData: import.meta.env.VITE_USE_DEMO_DATA === 'true',
  environment: import.meta.env.MODE
};
```

---

## Critical Success Criteria

✅ **Repository Pattern:** All data access through interfaces, demo data swappable with real API
✅ **Type Safety:** Full TypeScript coverage, no `any` types
✅ **Routing:** Nested routes with URL state, bookmarkable searches
✅ **State Management:** Zustand for app state, TanStack Query for server state
✅ **Performance:** Virtual scrolling, handles 100+ studies smoothly
✅ **Accessibility:** Keyboard navigation, screen reader support
✅ **Responsive:** Works on desktop and tablet
✅ **Theme:** Dark/light mode toggle
✅ **Production Ready:** Error boundaries, loading states, proper error handling

---

## Out of Scope (Don't Build)

❌ Authentication system (will integrate later with Orthanc's auth)
❌ Real API client (stub OrthancStudyRepository with console.logs)
❌ DICOM image viewer (will integrate OHIF later)
❌ PDF report generation
❌ Real-time updates via WebSocket
❌ Backend server (pure SPA only)

---

## Deliverable Checklist

- [ ] Project scaffolded with Vite + React + TypeScript
- [ ] Tailwind CSS configured with custom theme
- [ ] shadcn/ui components installed and styled
- [ ] Repository pattern implemented with interfaces
- [ ] Demo data generator with 100+ realistic studies
- [ ] DemoStudyRepository fully functional
- [ ] Zustand stores for UI and preferences
- [ ] React Router with nested routes
- [ ] Study List page with search, filters, virtual scrolling
- [ ] Study Detail page with series list and metadata
- [ ] Upload page with drag-drop and queue
- [ ] Remote Sources page structure (no API calls)
- [ ] Settings page with tabs for modalities, DICOMweb, preferences
- [ ] Dark/light theme toggle
- [ ] Responsive sidebar layout
- [ ] Loading states and error boundaries
- [ ] Keyboard shortcuts for study list
- [ ] README with architecture explanation and run instructions

---

## Example README to Include

````markdown
# Orthanc Explorer 3

Modern React UI for Orthanc DICOM server management.

## Architecture

This project uses **Domain-Driven Design** with a repository pattern:
- `domain/` - Business logic and models
- `infrastructure/` - Data access (repositories, API clients)
- `presentation/` - React components and pages
- `store/` - Zustand state management

**Data Access:** Currently uses demo data via `DemoStudyRepository`. To connect to real Orthanc:
1. Implement `OrthancStudyRepository` with API calls
2. Toggle `RepositoryFactory.useDemoData = false`
3. Set `VITE_ORTHANC_URL` environment variable

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Key Features

- Study list with virtual scrolling (handles 1000+ studies)
- Advanced search with URL state (shareable links)
- Study detail with series browser
- Drag-drop DICOM upload
- Modality management
- Dark/light theme

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- React Router v6
- Zustand (state)
- TanStack Query + TanStack Table
````

---

## Final Notes

**Tone:** This is a professional healthcare IT tool. UI should feel **clean, trustworthy, efficient**. Not flashy, not consumer-app playful. Think: "tool doctors can trust with patient data."

**Data Realism:** Demo data should feel real (varied patient names, realistic study dates spread over past year, appropriate modality distributions). Avoid obviously fake data like "Test Patient 1."

**Code Quality:** Follow enterprise standards - proper error handling, type safety, component composition, separation of concerns. This code will be reviewed by potential contributors.

---

Begin implementation with Study List page as the MVP. Ensure repository pattern works end-to-end before building other pages.
