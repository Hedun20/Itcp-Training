import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, getAccessToken, setAccessToken } from '../api/client';

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('access token refresh races', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setAccessToken(null);
  });

  it('retries a benign refresh race once and publishes the refreshed user', async () => {
    const refreshedUser = { id: 'user-1', name: 'Admin User', role: 'admin', status: 'active' };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'Expired' } }))
      .mockResolvedValueOnce(jsonResponse(409, { error: { code: 'REFRESH_RACE_RETRY', message: 'Retry', details: { retryable: true, retryAfterMs: 1 } } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: 'fresh-token', user: refreshedUser } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { protected: true } }));
    const refreshed = vi.fn();
    const expired = vi.fn();
    window.addEventListener('itcp:session-refreshed', refreshed, { once: true });
    window.addEventListener('itcp:session-expired', expired, { once: true });
    setAccessToken('expired-token');

    await expect(api.get('/protected')).resolves.toEqual({ protected: true });

    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    expect(globalThis.fetch.mock.calls[1][0]).toBe('/api/v1/auth/refresh');
    expect(globalThis.fetch.mock.calls[2][0]).toBe('/api/v1/auth/refresh');
    expect(globalThis.fetch.mock.calls[3][1].headers.get('Authorization')).toBe('Bearer fresh-token');
    expect(getAccessToken()).toBe('fresh-token');
    expect(refreshed).toHaveBeenCalledWith(expect.objectContaining({ detail: { user: refreshedUser } }));
    expect(expired).not.toHaveBeenCalled();
    window.removeEventListener('itcp:session-refreshed', refreshed);
    window.removeEventListener('itcp:session-expired', expired);
  });

  it('does not clear the local session when the one retry still reports a benign race', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'Expired' } }))
      .mockResolvedValueOnce(jsonResponse(409, { error: { code: 'REFRESH_RACE_RETRY', message: 'Retry', details: { retryAfterMs: 1 } } }))
      .mockResolvedValueOnce(jsonResponse(409, { error: { code: 'REFRESH_RACE_RETRY', message: 'Retry later', details: { retryAfterMs: 1 } } }));
    const expired = vi.fn();
    window.addEventListener('itcp:session-expired', expired);
    setAccessToken('expired-token');

    await expect(api.get('/protected')).rejects.toMatchObject({ status: 409, code: 'REFRESH_RACE_RETRY' });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe('expired-token');
    expect(expired).not.toHaveBeenCalled();
    window.removeEventListener('itcp:session-expired', expired);
  });
});
