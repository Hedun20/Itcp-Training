import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { AssessmentAttempt } from '../models/AssessmentAttempt';
import { Course } from '../models/Course';
import { CourseProgress } from '../models/CourseProgress';
import { attemptDto } from '../services/attemptService';
import { progressDto } from '../services/progressService';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate, requireRole('instructor'));

async function ownedCourseIds(instructorId: string) {
  return Course.find({ createdBy: instructorId }).distinct('_id');
}

router.get(
  '/progress',
  asyncHandler(async (request, response) => {
    const courseIds = await ownedCourseIds(request.auth!.userId);
    const progress = await CourseProgress.find({ courseId: { $in: courseIds } })
      .populate('userId', 'name email role status')
      .populate('courseId', 'code slug title modules._id')
      .sort({ updatedAt: -1 })
      .limit(5_000);
    const data = progress.map((entry: any) => {
      const validModuleIds = new Set((entry.courseId?.modules ?? []).map((module: any) => module._id.toString()));
      const completedCount = entry.completedModuleIds.filter((id: any) => validModuleIds.has(id.toString())).length;
      const moduleCount = validModuleIds.size;
      const percentage = moduleCount ? Math.round((completedCount / moduleCount) * 100) : 0;
      return {
        ...progressDto(entry),
        moduleCount,
        percentage,
        completionPercentage: percentage,
        user: entry.userId && typeof entry.userId === 'object'
          ? { id: entry.userId._id.toString(), name: entry.userId.name, email: entry.userId.email }
          : undefined,
      };
    });
    response.json({ data, progress: data });
  }),
);

router.get(
  '/results',
  asyncHandler(async (request, response) => {
    const courseIds = await ownedCourseIds(request.auth!.userId);
    const attempts = await AssessmentAttempt.find({ courseId: { $in: courseIds } })
      .populate('userId', 'name email')
      .populate('courseId', 'code slug title')
      .sort({ submittedAt: -1 })
      .limit(10_000);
    const data = attempts.map((attempt: any) => ({
      ...attemptDto(attempt),
      user: attempt.userId && typeof attempt.userId === 'object'
        ? { id: attempt.userId._id.toString(), name: attempt.userId.name, email: attempt.userId.email }
        : undefined,
    }));
    response.json({ data, results: data, attempts: data });
  }),
);

export { router as instructorRoutes };
