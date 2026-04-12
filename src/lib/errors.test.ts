import { describe, it, expect } from 'vitest';
import { OrthancError, scrubbedHttpMessage } from '@/lib/errors';

describe('OrthancError', () => {
  it('stores status and correlationId', async () => {
    const res = new Response('Internal boom', { status: 500 });
    const err = await OrthancError.from(res, 'corr-1');
    expect(err.status).toBe(500);
    expect(err.correlationId).toBe('corr-1');
    expect(err.message).not.toContain('boom'); // scrubbed display
  });

  it('produces user-friendly messages per status', async () => {
    const err = await OrthancError.from(new Response('', { status: 403 }), 'c');
    expect(err.message).toMatch(/not authorized/i);
  });

  it('sets err.name to OrthancError', async () => {
    const err = await OrthancError.from(new Response('', { status: 404 }), 'x');
    expect(err.name).toBe('OrthancError');
  });

  it('is an instance of Error', async () => {
    const err = await OrthancError.from(new Response('', { status: 500 }), 'y');
    expect(err).toBeInstanceOf(Error);
  });

  it('falls back to generic message for unmapped status codes', async () => {
    const err = await OrthancError.from(new Response('', { status: 422 }), 'c');
    expect(err.message).toMatch(/422/);
    expect(err.status).toBe(422);
  });
});

describe('scrubbedHttpMessage', () => {
  it('returns pre-scripted message for known status codes', () => {
    expect(scrubbedHttpMessage(403)).toBe('You are not authorized to perform this action.');
    expect(scrubbedHttpMessage(404)).toBe('The requested resource was not found.');
  });
  it('returns generic fallback for unknown codes', () => {
    expect(scrubbedHttpMessage(418)).toBe('Request failed (418).');
  });
});
