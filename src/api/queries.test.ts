import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queriesApi } from './queries';
import { orthancFetch } from '@/lib/client';

vi.mock('@/lib/client', () => ({
  orthancFetch: vi.fn(),
  JSON_CONTENT_HEADERS: { 'Content-Type': 'application/json' },
}));

describe('queriesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queryModality() calls POST /modalities/:name/query', async () => {
    vi.mocked(orthancFetch).mockResolvedValue({ ID: 'query-123', Path: '/queries/query-123' });

    const res = await queriesApi.queryModality('PACS_REMOTE', {
      Level: 'Study',
      Query: { PatientID: 'P123' },
    });

    expect(orthancFetch).toHaveBeenCalledWith('/modalities/PACS_REMOTE/query', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ Level: 'Study', Query: { PatientID: 'P123' } }),
    }));
    expect(res.ID).toBe('query-123');
  });

  it('getAnswers() calls GET /queries/:id/answers', async () => {
    vi.mocked(orthancFetch).mockResolvedValue([0, 1, 2]);

    const res = await queriesApi.getAnswers('query-123');

    expect(orthancFetch).toHaveBeenCalledWith('/queries/query-123/answers');
    expect(res).toEqual([0, 1, 2]);
  });

  it('getAnswerContent() calls GET /queries/:id/answers/:index/content?simplify', async () => {
    vi.mocked(orthancFetch).mockResolvedValue({ PatientName: 'Demo^Patient', PatientID: 'P123' });

    const res = await queriesApi.getAnswerContent('query-123', 0);

    expect(orthancFetch).toHaveBeenCalledWith('/queries/query-123/answers/0/content?simplify');
    expect(res.PatientID).toBe('P123');
  });

  it('retrieveAnswer() calls POST /queries/:id/answers/:index/retrieve', async () => {
    vi.mocked(orthancFetch).mockResolvedValue({ Description: 'REST API' });

    await queriesApi.retrieveAnswer('query-123', 0, 'LOCAL_PACS');

    expect(orthancFetch).toHaveBeenCalledWith('/queries/query-123/answers/0/retrieve', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify('LOCAL_PACS'),
    }));
  });
});
