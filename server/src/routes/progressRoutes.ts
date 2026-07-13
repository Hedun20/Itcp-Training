import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Course } from '../models/Course';
import { CourseProgress } from '../models/CourseProgress';
import { progressDto } from '../services/progressService';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate);

const courseParams = z.object({ courseId: z.string().min(1).max(200) });
const userParams = z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i) });
const updateProgress = z.object({
  currentModuleIndex: z.number().int().min(0),
  completedModuleIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(200).default([]),
});

async function resolveCourse(identifier: string, isAdmin: boolean) {
  const selector = isValidObjectId(identifier) ? { _id: identifier } : { slug: identifier.toLowerCase() };
  const course = await Course.findOne(isAdmin ? selector : { ...selector, status: 'published' });
  if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'Published course not found');
  return course;
}

router.get(
  ['/me', '/'],
  asyncHandler(async (request, response) => {
    const progress = await CourseProgress.find({ userId: request.auth!.userId })
      .populate('courseId', 'code slug title coverImage estimatedDuration')
      .sort({ lastAccessedAt: -1, updatedAt: -1 });
    const data = progress.map(progressDto);
    response.json({ data, progress: data });
  }),
);

router.get(
  '/users/:userId',
  requireRole('admin'),
  validate({ params: userParams }),
  asyncHandler(async (request, response) => {
    const progress = await CourseProgress.find({ userId: request.params.userId })
      .populate('courseId', 'code slug title coverImage estimatedDuration')
      .sort({ updatedAt: -1 });
    const data = progress.map(progressDto);
    response.json({ data, progress: data });
  }),
);

router.get(
  '/:courseId',
  validate({ params: courseParams }),
  asyncHandler(async (request, response) => {
    const course = await resolveCourse(request.params.courseId as string, request.auth!.role === 'admin');
    let progress = await CourseProgress.findOne({ userId: request.auth!.userId, courseId: course._id });
    if (!progress) {
      progress = await CourseProgress.create({
        userId: request.auth!.userId,
        courseId: course._id,
        status: 'not_started',
        currentModuleIndex: 0,
        completedModuleIds: [],
        passed: false,
      });
    }
    const data = progressDto(progress);
    response.json({ data, progress: data });
  }),
);

async function saveProgress(request: any, response: any) {
  const course = await resolveCourse(request.params.courseId, request.auth.role === 'admin');
  if (course.modules.length === 0) throw new AppError(409, 'COURSE_HAS_NO_MODULES', 'Course has no modules');
  if (request.body.currentModuleIndex >= course.modules.length) {
    throw new AppError(422, 'INVALID_MODULE_INDEX', 'Current module index is outside this course');
  }
  const validModuleIds = new Set(course.modules.map((module) => module._id.toString()));
  const completedIds = [...new Set<string>(request.body.completedModuleIds)];
  if (completedIds.some((id) => !validModuleIds.has(id))) {
    throw new AppError(422, 'INVALID_MODULE', 'Completed modules must belong to this course');
  }
  const now = new Date();
  let progress = await CourseProgress.findOne({ userId: request.auth.userId, courseId: course._id });
  if (!progress) {
    progress = new CourseProgress({
      userId: request.auth.userId,
      courseId: course._id,
      passed: false,
      startedAt: now,
    });
  }
  progress.currentModuleIndex = request.body.currentModuleIndex;
  progress.completedModuleIds = completedIds as any;
  progress.startedAt ??= now;
  progress.lastAccessedAt = now;
  const fullyCompleted = progress.passed && completedIds.length === course.modules.length;
  progress.status = fullyCompleted ? 'completed' : 'in_progress';
  progress.completedAt = fullyCompleted ? progress.completedAt ?? now : undefined;
  await progress.save();
  const data = progressDto(progress);
  response.json({ data, progress: data });
}

router.put('/:courseId', validate({ params: courseParams, body: updateProgress }), asyncHandler(saveProgress));
router.post('/:courseId', validate({ params: courseParams, body: updateProgress }), asyncHandler(saveProgress));

export { router as progressRoutes };
