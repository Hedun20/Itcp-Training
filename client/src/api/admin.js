import { api } from './client';

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  async users(query) {
    const payload = await api.get('/admin/users', { query });
    return payload?.users || payload?.items || payload || [];
  },
  async results(query) {
    const payload = await api.get('/admin/results', { query });
    return payload?.results || payload?.items || payload || [];
  },
  updateUser: (id, update) => api.patch(`/users/${id}`, update),
  async media() {
    const payload = await api.get('/media');
    return payload?.media || payload?.items || payload || [];
  },
  async uploadMedia(file, altText = '') {
    const form = new FormData();
    form.append('image', file);
    form.append('altText', altText);
    const payload = await api.post('/media', form);
    return payload?.asset || payload;
  },
  deleteMedia: (id) => api.delete(`/media/${id}`),
  exportResults: (query) => api.download('/admin/results/export', { query }),
  async progress(query) {
    const payload = await api.get('/admin/progress', { query });
    return payload?.progress || payload?.items || payload || [];
  },
};
