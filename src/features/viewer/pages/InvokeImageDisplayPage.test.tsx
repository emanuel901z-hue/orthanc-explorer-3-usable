import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InvokeImageDisplayPage from './InvokeImageDisplayPage';
import '@/i18n';

const { mockFindAll } = vi.hoisted(() => ({ mockFindAll: vi.fn() }));
const replace = vi.fn();

vi.mock('@/shared/api/repository-factory', () => ({
  RepositoryFactory: { createStudyRepository: () => ({ findAll: mockFindAll }) },
}));

vi.mock('@/lib/viewer-session', () => ({
  requestViewerSession: vi.fn(() => Promise.resolve()),
}));

function renderPage(query: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/IHEInvokeImageDisplay?${query}`]}>
        <Routes>
          <Route path="/IHEInvokeImageDisplay" element={<InvokeImageDisplayPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InvokeImageDisplayPage (IHE RAD-106)', () => {
  beforeEach(() => {
    // jsdom cannot navigate — the redirect is the thing under test, so it is
    // observed instead of performed.
    vi.stubGlobal('location', { search: '', pathname: '/', href: '', replace });
    replace.mockClear();
    mockFindAll.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the viewer for a study UID without asking the PACS', async () => {
    renderPage('requestType=STUDY&studyUID=1.2.3');

    await waitFor(() => expect(replace).toHaveBeenCalledWith(
      '/ohif/viewer?StudyInstanceUIDs=1.2.3',
    ));
    expect(mockFindAll).not.toHaveBeenCalled();
    expect(screen.getByText('Invoke image display')).toBeInTheDocument();
  });

  it('carries a whole study list through', async () => {
    renderPage('requestType=STUDY&studyUID=1.2.3,1.2.4');

    await waitFor(() => expect(replace).toHaveBeenCalledWith(
      '/ohif/viewer?StudyInstanceUIDs=1.2.3,1.2.4',
    ));
  });

  it('resolves an accession number into the study UID', async () => {
    mockFindAll.mockResolvedValue([{ studyInstanceUID: '9.8.7' }]);

    renderPage('requestType=STUDY&accessionNumber=ACC-1');

    await waitFor(() => expect(replace).toHaveBeenCalledWith(
      '/ohif/viewer?StudyInstanceUIDs=9.8.7',
    ));
    expect(mockFindAll).toHaveBeenCalledWith({ accessionNumber: 'ACC-1' });
  });

  it('resolves a patient request and honours mostRecentResults', async () => {
    mockFindAll.mockResolvedValue([
      { studyInstanceUID: 'old', studyDate: new Date('2024-01-01') },
      { studyInstanceUID: 'new', studyDate: new Date('2026-09-01') },
    ]);

    renderPage('requestType=PATIENT&patientID=P1&mostRecentResults=1');

    await waitFor(() => expect(replace).toHaveBeenCalledWith(
      '/ohif/viewer?StudyInstanceUIDs=new',
    ));
    expect(mockFindAll).toHaveBeenCalledWith({ patientId: 'P1' });
  });

  it('opens the configured OHIF URL when a deployment points it elsewhere', async () => {
    localStorage.setItem('oe3-viewers', JSON.stringify([
      { id: 'ohif', url: 'https://viewer.example.org/ohif', enabled: true, type: 'web' },
    ]));

    renderPage('requestType=STUDY&studyUID=1.2.3');

    await waitFor(() => expect(replace).toHaveBeenCalledWith(
      'https://viewer.example.org/ohif?StudyInstanceUIDs=1.2.3',
    ));
  });

  it('says what is wrong instead of opening something', async () => {
    renderPage('requestType=STUDY&studyUID=1.2.3&accessionNumber=ACC-1');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Give either “studyUID” or “accessionNumber” — not both.',
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('reports a request without a key', async () => {
    renderPage('requestType=STUDY');

    expect(await screen.findByRole('alert')).toHaveTextContent('A STUDY request needs');
    expect(replace).not.toHaveBeenCalled();
  });

  it('says so when the accession number is unknown here', async () => {
    mockFindAll.mockResolvedValue([]);

    renderPage('requestType=STUDY&accessionNumber=ACC-UNKNOWN');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No study found for this request.',
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('reports a PACS that cannot be queried', async () => {
    mockFindAll.mockRejectedValue(new Error('boom'));

    renderPage('requestType=PATIENT&patientID=P1');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The PACS could not be queried',
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
