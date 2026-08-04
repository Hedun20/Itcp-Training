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
    const payload = await api.post('/auth/register', details, { skipRefresh: true });
    if (payload?.verificationRequired) return payload;
    return authResult(payload);
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
  async emailVerificationStatus() {
    const payload = await api.get('/auth/email-verification/status', { skipRefresh: true });
    return payload || { enabled: false, required: false };
  },
  async verifyEmail(token) {
    return api.post('/auth/verify-email', { token }, { skipRefresh: true });
  },
  async resendVerification(email) {
    return api.post('/auth/resend-verification', { email }, { skipRefresh: true });
  },
  async passwordResetStatus() {
    const payload = await api.get('/auth/password-reset/status', { skipRefresh: true });
    return payload?.enabled ?? payload?.data?.enabled ?? false;
  },
  async requestPasswordReset(email) {
    return api.post('/auth/forgot-password', { email }, { skipRefresh: true });
  },
  async resetPassword(token, password) {
    return api.post('/auth/reset-password', { token, password }, { skipRefresh: true });
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
