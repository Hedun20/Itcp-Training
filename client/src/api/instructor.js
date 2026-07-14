import { api } from './client';

export const instructorApi = {
  async progress(query) {
    const payload = await api.get('/instructor/progress', { query });
    return payload?.progress || payload?.items || payload || [];
  },
  async results(query) {
    const payload = await api.get('/instructor/results', { query });
    return payload?.results || payload?.items || payload || [];
  },
};
