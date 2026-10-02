import { describe, it, expect } from 'vitest';
import { OrthancError, scrubbedHttpMessage, describeError } from '@/lib/errors';
import i18n from '@/i18n';

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
    expect(err.message).toMatch(/not allowed/i);
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
  it('returns the translated message for known status codes', () => {
    // the wording lives in the locale, so the test pins the wiring, not the text
    expect(scrubbedHttpMessage(403)).toBe(i18n.t('errors.http403'));
    expect(scrubbedHttpMessage(404)).toBe(i18n.t('errors.http404'));
  });

  it('speaks the operator language — a German UI shows German errors', async () => {
    // the message is what a toast, an inline alert and a dialog print, so it has
    // to follow the interface language (it used to be English everywhere)
    await i18n.changeLanguage('de');
    expect(scrubbedHttpMessage(409)).toContain('kollidiert');
    expect(scrubbedHttpMessage(0)).toContain('Keine Verbindung');

    await i18n.changeLanguage('en');
    expect(scrubbedHttpMessage(409)).toContain('clashes');
  });
  it('returns generic fallback for unknown codes', () => {
    expect(scrubbedHttpMessage(418)).toBe('Request failed (418).');
  });
});

describe('describeError', () => {
  const t = (key: string, options?: Record<string, unknown>) =>
    String(i18n.t(key, options as never));

  it('appends the correlation id — support asks for it', () => {
    const err = new OrthancError(500, 'corr-42', 'The server encountered an error.');
    expect(describeError(err, t)).toContain('corr-42');
    expect(describeError(err, t)).toContain('The server encountered an error.');
  });

  it('passes an action error through unchanged', () => {
    expect(describeError(new Error('no route to host'), t)).toBe('no route to host');
  });

  it('has a sentence for something that is not an error at all', () => {
    expect(describeError({ weird: true }, t)).toBe(i18n.t('errors.unknown'));
    expect(describeError(undefined, t)).toBe(i18n.t('errors.unknown'));
  });

  it('speaks the operator language', async () => {
    await i18n.changeLanguage('de');
    const err = new OrthancError(409, 'c1', 'Das kollidiert mit dem, was schon da ist.');
    expect(describeError(err, t)).toContain('Ref: c1');
    await i18n.changeLanguage('en');
  });
});
