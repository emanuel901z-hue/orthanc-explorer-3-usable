import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryModalityAction } from './queryModality';
import { queriesApi } from '@/api/queries';
import { auditClient } from '@/lib/audit';

vi.mock('@/api/queries', () => ({
  queriesApi: {
    queryModality: vi.fn(),
    getAnswers: vi.fn(),
    getAnswerContent: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
  auditClient: {
    emit: vi.fn(),
  },
}));

describe('queryModalityAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries modality and fetches content for all answers', async () => {
    vi.mocked(queriesApi.queryModality).mockResolvedValue({ ID: 'q-1', Path: '/queries/q-1' });
    vi.mocked(queriesApi.getAnswers).mockResolvedValue([0, 1]);
    vi.mocked(queriesApi.getAnswerContent).mockImplementation(async (_qId, idx) => ({
      PatientName: `Patient^${idx}`,
      PatientID: `P00${idx}`,
    }));

    const result = await queryModalityAction('MODALITY_1', {
      Query: { PatientID: '*' },
    });

    expect(queriesApi.queryModality).toHaveBeenCalledWith('MODALITY_1', { Query: { PatientID: '*' } });
    expect(queriesApi.getAnswers).toHaveBeenCalledWith('q-1');
    expect(result.answers).toHaveLength(2);
    expect(result.answers[0].tags.PatientName).toBe('Patient^0');
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'started', action: 'modality.query' }),
    );
    expect(auditClient.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', action: 'modality.query' }),
    );
  });
});
