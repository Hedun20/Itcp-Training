import type { ICourseProgress } from '../models/CourseProgress';

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
