const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

let accessToken = null;
let refreshPromise = null;
const RETRYABLE_REFRESH_CODES = new Set(['REFRESH_RACE_RETRY', 'REFRESH_ROTATION_IN_PROGRESS']);

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', details, requestId } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

function buildUrl(path, query) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;
  if (!query) return url;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else params.set(key, value);
  });
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

async function parseResponse(response, responseType) {
  if (response.status === 204) return null;
  if (responseType === 'blob') return response.blob();
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) return response.json();
  const text = await response.text();
  return text ? { message: text } : null;
}

async function rawRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    query,
    token = accessToken,
    signal,
    responseType,
    headers: customHeaders,
  } = options;
  const headers = new Headers(customHeaders || {});
  headers.set('Accept', responseType === 'blob' ? '*/*' : 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let payload = body;
  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    credentials: 'include',
    headers,
    body: payload,
    signal,
  });
  const parsed = await parseResponse(response, responseType);
  if (!response.ok) {
    const error = parsed?.error || parsed || {};
    throw new ApiError(error.message || `Request failed (${response.status})`, {
      status: response.status,
      code: error.code,
      details: error.details,
      requestId: error.requestId || response.headers.get('x-request-id'),
    });
  }
  return parsed;
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function isRetryableRefreshRace(error) {
  return error.status === 409 && RETRYABLE_REFRESH_CODES.has(error.code);
}

async function requestRefreshSession() {
  try {
    return await rawRequest('/auth/refresh', { method: 'POST', token: null });
  } catch (error) {
    if (!isRetryableRefreshRace(error)) throw error;
    const advertisedDelay = Number(error.details?.retryAfterMs);
    const retryDelay = Number.isFinite(advertisedDelay) ? Math.min(Math.max(advertisedDelay, 25), 1_000) : 100;
    await wait(retryDelay);
    return rawRequest('/auth/refresh', { method: 'POST', token: null });
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = requestRefreshSession()
      .then((payload) => {
        const result = payload?.data || payload || {};
        const token = result.accessToken || result.token;
        if (!token) throw new ApiError('Session renewal failed.', { status: 401, code: 'REFRESH_FAILED' });
        setAccessToken(token);
        if (result.user) window.dispatchEvent(new CustomEvent('itcp:session-refreshed', { detail: { user: result.user } }));
        return token;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function request(path, options = {}) {
  try {
    const payload = await rawRequest(path, options);
    return payload?.data ?? payload;
  } catch (error) {
    if (error.status !== 401 || options.skipRefresh || path === '/auth/refresh') throw error;
    try {
      const token = await refreshAccessToken();
      const payload = await rawRequest(path, { ...options, token, skipRefresh: true });
      return payload?.data ?? payload;
    } catch (refreshError) {
      if (isRetryableRefreshRace(refreshError)) throw refreshError;
      setAccessToken(null);
      window.dispatchEvent(new CustomEvent('itcp:session-expired'));
      throw refreshError;
    }
  }
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  download: (path, options) => request(path, { ...options, method: 'GET', responseType: 'blob' }),
};
