export class CourseImportError extends Error {
  constructor(message, { code = 'COURSE_IMPORT_FAILED', cause, details } = {}) {
    super(message, { cause });
    this.name = 'CourseImportError';
    this.code = code;
    this.details = details;
  }
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

export function toText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

export function addFixed(report, path, message) {
  report.autoFixed.push({ path, message });
}

export function addReview(report, path, message) {
  report.reviewRequired.push({ path, message });
}

export function clipText(value, maxLength, path, report) {
  const text = toText(value);
  if (text.length <= maxLength) return text;
  addFixed(report, path, `Content was shortened to ${maxLength} characters.`);
  return text.slice(0, maxLength).trimEnd();
}

export function clampNumber(value, { min, max, fallback, integer = false }, path, report) {
  const parsed = typeof value === 'string' && value.trim() !== ''
    ? Number(value.trim().replace(/%$/, ''))
    : value;
  if (!Number.isFinite(parsed)) {
    if (value !== undefined && value !== null && value !== '') addFixed(report, path, `Invalid number was replaced with ${fallback}.`);
    return fallback;
  }
  const normalized = integer ? Math.round(parsed) : parsed;
  const clamped = Math.min(max, Math.max(min, normalized));
  if (clamped !== parsed) addFixed(report, path, `Value was constrained to the supported range ${min}-${max}.`);
  return clamped;
}

export { parseJsonText } from './courseImportParser';
