import { resolveMediaUrl } from './media';

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', ...options }).format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function courseId(course) {
  return course?._id || course?.id;
}

export function moduleId(module, index = 0) {
  return module?._id || module?.id || `module-${index}`;
}

export function courseFromRecord(record) {
  return record?.course || (typeof record?.courseId === 'object' ? record.courseId : null);
}

export function completionPercentage(progress, moduleCount = 0) {
  if (progress?.status === 'completed') return 100;
  if (Number.isFinite(progress?.percentage)) return Math.max(0, Math.min(100, progress.percentage));
  if (!moduleCount) return 0;
  return Math.round(((progress?.completedModuleIds?.length || 0) / moduleCount) * 100);
}

const seededPlaceholders = {
  'DCT-01': '/course-placeholder-foundations.svg',
  'DCT-02': '/course-placeholder-compliance.svg',
  'HSE-01': '/course-placeholder-safety.svg',
  'ACS-01': '/course-placeholder-practice.svg',
};

export function courseCoverUrl(course) {
  return resolveMediaUrl(course?.coverImage?.url || course?.coverImage || seededPlaceholders[course?.code] || '/course-placeholder-foundations.svg');
}
