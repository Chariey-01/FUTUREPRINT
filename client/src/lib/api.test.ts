import {
  ApiRequestError,
  isSessionGone,
  isStaleStep,
  request,
  setTransport,
  type Transport,
} from './api';
import { sessionToken } from './sessionToken';

describe('API client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setTransport(null);
  });

  it('adds the bearer token only to authenticated requests and keeps it out of the URL', async () => {
    const transport = vi.fn<Transport>(async () => ({ status: 200, body: {} }));
    setTransport(transport);
    sessionToken.set('secret-token');
    await request('/api/v1/occupations');
    await request('/api/v1/sessions/current', { auth: true });
    expect(transport.mock.calls[0]![0].headers.Authorization).toBeUndefined();
    expect(transport.mock.calls[1]![0].headers.Authorization).toBe('Bearer secret-token');
    transport.mock.calls.forEach(([req]) => expect(req.path).not.toContain('secret-token'));
  });

  it('sends JSON bodies with a content type', async () => {
    const transport = vi.fn<Transport>(async () => ({ status: 201, body: { ok: true } }));
    setTransport(transport);
    const res = await request('/api/v1/sessions', { method: 'POST', body: { occupationId: 'x' } });
    expect(res).toEqual({ ok: true });
    const req = transport.mock.calls[0]![0];
    expect(req.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(req.body!)).toEqual({ occupationId: 'x' });
  });

  it('maps network failures to a friendly NETWORK_ERROR', async () => {
    setTransport(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(request('/api/v1/occupations')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });

  it('falls back to a status-based error when the body is not an envelope', async () => {
    setTransport(async () => ({ status: 503, body: null }));
    await expect(request('/api/v1/occupations')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 503,
    });
  });

  it('marks the session as expired on SESSION_EXPIRED', async () => {
    setTransport(async () => ({
      status: 401,
      body: { error: { code: 'SESSION_EXPIRED', message: 'gone' } },
    }));
    sessionToken.set('t');
    await request('/api/v1/sessions/current', { auth: true }).catch(() => {});
    expect(sessionToken.snapshot()).toEqual({ token: null, endReason: 'expired' });
  });

  it('fails fast without a token on authenticated calls', async () => {
    await expect(request('/api/v1/sessions/current', { auth: true })).rejects.toMatchObject({
      code: 'SESSION_NOT_FOUND',
      status: 401,
    });
  });

  it('parses the error envelope and clears the token on an unknown session', async () => {
    sessionToken.set('not-a-real-token');
    const err = (await request('/api/v1/sessions/current', { auth: true }).catch(
      (e) => e,
    )) as ApiRequestError;
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err.code).toBe('SESSION_NOT_FOUND');
    expect(isSessionGone(err)).toBe(true);
    expect(sessionToken.get()).toBeNull();
  });

  it('identifies stale-step errors', () => {
    expect(isStaleStep(new ApiRequestError(409, 'STALE_STEP', 'x'))).toBe(true);
    expect(isStaleStep(new ApiRequestError(409, 'OTHER', 'x'))).toBe(false);
  });

  it('never writes the token to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m),
    );
    sessionToken.set('super-secret');
    await request('/api/v1/sessions/current', { auth: true }).catch(() => {});
    spies.forEach((s) =>
      s.mock.calls.flat().forEach((arg) => expect(String(arg)).not.toContain('super-secret')),
    );
  });
});
