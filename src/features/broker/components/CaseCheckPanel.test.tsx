import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CaseCheckPanel, parseTagValues } from './CaseCheckPanel';
import { loadConfig, __resetConfigForTests } from '@/config/runtime';
import '@/i18n';

const { mockTransform } = vi.hoisted(() => ({ mockTransform: vi.fn() }));
vi.mock('@/api/broker', () => ({
  brokerApi: { simulate: { transform: mockTransform, route: vi.fn() } },
}));

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><CaseCheckPanel /></QueryClientProvider>);
}

describe('parseTagValues', () => {
  it('parses Tag=Value lines, skipping blanks and comments', () => {
    expect(parseTagValues('PatientID=P1\n\n# comment\nInstitutionName = ALT ')).toEqual({
      PatientID: 'P1',
      InstitutionName: 'ALT',
    });
  });

  it('keeps "=" inside the value and ignores lines without one', () => {
    expect(parseTagValues('StudyDescription=CT=Thorax\nno-separator')).toEqual({
      StudyDescription: 'CT=Thorax',
    });
  });

  it('returns an empty map for empty input', () => {
    expect(parseTagValues('')).toEqual({});
  });
});

describe('CaseCheckPanel', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = { orthancUrl: '', brokerUrl: '/broker-api', authMode: 'none', features: {} };
    loadConfig();
    mockTransform.mockResolvedValue({
      accession: 'ACC-1', study_uid: '', matched_via: 'accession',
      source_id: 1, source_name: 'ris-a', target_id: 2, target_name: 'pacs-kh',
      rule_id: 3, reason: 'rule 3 (10) matched via accession',
      rules_applied: ['kh-prefix'],
      changes: [{ tag: 'PatientID', before: 'P1', after: 'KH_P1' }],
      errors: [],
    });
  });
  afterEach(() => { __resetConfigForTests(); vi.clearAllMocks(); });

  it('stays disabled until a case is entered', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /run check/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/accession number/i), { target: { value: 'ACC-1' } });
    expect(screen.getByRole('button', { name: /run check/i })).toBeEnabled();
  });

  it('sends the case and shows the routing decision plus the tag diff', async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/accession number/i), { target: { value: 'ACC-1' } });
    fireEvent.change(screen.getByLabelText(/tag values to test/i), {
      target: { value: 'PatientID=P1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run check/i }));

    await waitFor(() => expect(mockTransform).toHaveBeenCalledWith({
      accession: 'ACC-1', study_uid: '', values: { PatientID: 'P1' },
    }));

    const result = await screen.findByTestId('case-check-result');
    expect(result).toHaveTextContent('ris-a → pacs-kh');
    expect(result).toHaveTextContent(/matched via accession/i);
    expect(result).toHaveTextContent(/rule 3/);
    expect(result).toHaveTextContent('KH_P1');
  });

  it('shows a rejection when no target matches', async () => {
    mockTransform.mockResolvedValue({
      accession: 'ACC-X', study_uid: '', matched_via: 'none',
      source_id: null, source_name: null, target_id: null, target_name: null,
      rule_id: null, reason: 'no matching rule and no enabled default target — the store is rejected',
      rules_applied: [], changes: [], errors: [],
    });
    renderPanel();
    fireEvent.change(screen.getByLabelText(/accession number/i), { target: { value: 'ACC-X' } });
    fireEvent.click(screen.getByRole('button', { name: /run check/i }));

    expect(await screen.findByText(/no target \(would be rejected\)/i)).toBeInTheDocument();
  });

  it('lists operations that would fail', async () => {
    mockTransform.mockResolvedValue({
      accession: 'ACC-1', study_uid: '', matched_via: 'default',
      source_id: null, source_name: null, target_id: 1, target_name: 'pacs',
      rule_id: null, reason: 'default target',
      rules_applied: ['broken'], changes: [], errors: ['broken[1]: source tag is empty'],
    });
    renderPanel();
    fireEvent.change(screen.getByLabelText(/accession number/i), { target: { value: 'ACC-1' } });
    fireEvent.click(screen.getByRole('button', { name: /run check/i }));

    expect(await screen.findByText(/broken\[1\]: source tag is empty/)).toBeInTheDocument();
  });

  it('reports a failed simulation', async () => {
    mockTransform.mockRejectedValue(new Error('broker unreachable'));
    renderPanel();
    fireEvent.change(screen.getByLabelText(/accession number/i), { target: { value: 'ACC-1' } });
    fireEvent.click(screen.getByRole('button', { name: /run check/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('broker unreachable');
  });
});
