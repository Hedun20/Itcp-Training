import { api, setAccessToken } from './client';

function authResult(payload) {
  const result = payload?.auth || payload || {};
  const token = result.accessToken || result.token;
  if (token) setAccessToken(token);
  return { user: result.user || payload?.user, accessToken: token };
}

export const authApi = {
  async login(credentials) {
    return authResult(await api.post('/auth/login', credentials, { skipRefresh: true }));
  },
  async register(details) {
    return authResult(await api.post('/auth/register', details, { skipRefresh: true }));
  },
  async currentUser() {
    const payload = await api.get('/auth/me');
    return payload?.user || payload;
  },
  async logout() {
    try { await api.post('/auth/logout'); } finally { setAccessToken(null); }
  },
  async googleStatus() {
    const payload = await api.get('/auth/google/status', { skipRefresh: true });
    return payload?.enabled ?? payload?.available ?? false;
  },
  async completeGoogle(query) {
    const payload = await api.get('/auth/google/callback', { query, skipRefresh: true });
    return authResult(payload);
  },
  async completeGoogleRegistration(details) {
    return authResult(await api.post('/auth/google/complete-registration', details, { skipRefresh: true }));
  },
  async updateProfile(update) {
    const payload = await api.patch('/users/me', update);
    return payload?.user || payload;
  },
};
