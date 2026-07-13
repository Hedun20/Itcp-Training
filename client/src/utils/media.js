export function resolveMediaUrl(value) {
  if (!value || typeof value !== 'string') return value || '';
  if (/^(?:https?:|data:|blob:)/i.test(value)) return value;
  if (!value.startsWith('/uploads/')) return value;
  const configuredMediaOrigin = import.meta.env.VITE_MEDIA_ORIGIN;
  if (configuredMediaOrigin) return `${configuredMediaOrigin.replace(/\/$/, '')}${value}`;
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl && /^https?:\/\//i.test(apiUrl)) {
    try { return `${new URL(apiUrl).origin}${value}`; } catch { return value; }
  }
  return value;
}
