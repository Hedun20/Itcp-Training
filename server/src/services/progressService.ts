import type { ICourseProgress } from '../models/CourseProgress';
import { CourseProgress, type CourseProgressDocument } from '../models/CourseProgress';

export function sanitizeProgressDocument(
  progress: CourseProgressDocument,
  newModuleIds: string[],
  oldModuleIds?: string[],
): boolean {
  const validIds = new Set(newModuleIds);
  const previousCompleted = progress.completedModuleIds.map((id) => id.toString());
  const completedModuleIds = [...new Set(previousCompleted.filter((id) => validIds.has(id)))];
  const previousIndex = progress.currentModuleIndex;
  let currentModuleIndex = 0;
  if (newModuleIds.length > 0) {
    const previousCurrentId = oldModuleIds?.[previousIndex];
    const movedIndex = previousCurrentId ? newModuleIds.indexOf(previousCurrentId) : -1;
    currentModuleIndex = movedIndex >= 0 ? movedIndex : Math.min(previousIndex, newModuleIds.length - 1);
  }

  const complete =
    progress.passed && newModuleIds.length > 0 && completedModuleIds.length === newModuleIds.length;
  const untouched =
    progress.status === 'not_started' && !progress.startedAt && completedModuleIds.length === 0 && !progress.passed;
  const status = complete ? 'completed' : untouched ? 'not_started' : 'in_progress';
  const completedAt = complete ? progress.completedAt ?? new Date() : undefined;
  const changed =
    currentModuleIndex !== previousIndex ||
    status !== progress.status ||
    previousCompleted.join(',') !== completedModuleIds.join(',') ||
    String(progress.completedAt ?? '') !== String(completedAt ?? '');

  if (changed) {
    progress.currentModuleIndex = currentModuleIndex;
    progress.completedModuleIds = completedModuleIds as any;
    progress.status = status;
    progress.completedAt = completedAt;
  }
  return changed;
}

export async function sanitizeCourseProgressRecords(
  courseId: string,
  oldModuleIds: string[],
  newModuleIds: string[],
): Promise<void> {
  const records = await CourseProgress.find({ courseId });
  await Promise.all(
    records.map(async (progress) => {
      if (sanitizeProgressDocument(progress, newModuleIds, oldModuleIds)) await progress.save();
    }),
  );
}

export function progressDto(progress: ICourseProgress | any) {
  const course = progress.courseId && typeof progress.courseId === 'object' && 'title' in progress.courseId
    ? {
        id: progress.courseId._id.toString(),
        code: progress.courseId.code,
        slug: progress.courseId.slug,
        title: progress.courseId.title,
        coverImage: progress.courseId.coverImage,
        estimatedDuration: progress.courseId.estimatedDuration,
      }
    : undefined;
  return {
    id: progress._id.toString(),
    userId: progress.userId?._id?.toString?.() ?? progress.userId.toString(),
    courseId: course?.id ?? progress.courseId.toString(),
    ...(course ? { course } : {}),
    status: progress.status,
    currentModuleIndex: progress.currentModuleIndex,
    completedModuleIds: progress.completedModuleIds.map((id: any) => id.toString()),
    startedAt: progress.startedAt,
    lastAccessedAt: progress.lastAccessedAt,
    completedAt: progress.completedAt,
    bestScore: progress.bestScore,
    passed: progress.passed,
    updatedAt: progress.updatedAt,
  };
}
