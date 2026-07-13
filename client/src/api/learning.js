import { api } from './client';

export const learningApi = {
  async myProgress() {
    const payload = await api.get('/progress/me');
    return payload?.progress || payload?.items || payload || [];
  },
  async courseProgress(courseId) {
    const payload = await api.get(`/progress/${courseId}`);
    return payload?.progress || payload;
  },
  async saveProgress(courseId, update) {
    const payload = await api.put(`/progress/${courseId}`, update);
    return payload?.progress || payload;
  },
  async myAttempts() {
    const payload = await api.get('/attempts/me');
    return payload?.attempts || payload?.items || payload || [];
  },
  async attempt(id) {
    const payload = await api.get(`/attempts/${id}`);
    return payload?.attempt || payload;
  },
  async submitAssessment(courseId, answers) {
    const payload = await api.post('/attempts', { courseId, answers });
    return payload?.attempt || payload;
  },
};
