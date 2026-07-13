import { api } from './client';

export const coursesApi = {
  async list(query) {
    const payload = await api.get('/courses', { query });
    return payload?.courses || payload?.items || payload || [];
  },
  async get(slugOrId) {
    const payload = await api.get(`/courses/${encodeURIComponent(slugOrId)}`);
    return payload?.course || payload;
  },
  async create(course) {
    const payload = await api.post('/courses', course);
    return payload?.course || payload;
  },
  async update(id, course) {
    const payload = await api.patch(`/courses/${id}`, course);
    return payload?.course || payload;
  },
  async changeStatus(id, status) {
    const action = status === 'published' ? 'publish' : status === 'archived' ? 'archive' : 'unpublish';
    const payload = await api.post(`/courses/${id}/${action}`);
    return payload?.course || payload;
  },
};
