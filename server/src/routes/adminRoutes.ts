import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AssessmentAttempt } from '../models/AssessmentAttempt';
import { AuditLog } from '../models/AuditLog';
import { Course } from '../models/Course';
import { CourseProgress } from '../models/CourseProgress';
import { User } from '../models/User';
import { recordAudit } from '../services/auditService';
import { attemptDto } from '../services/attemptService';
import { progressDto } from '../services/progressService';
import { userDto } from '../services/userService';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { makeCsv } from '../utils/csv';

const router = Router();
router.use(authenticate, requireRole('admin'));

const idParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
const userUpdate = z
  .object({ role: z.enum(['admin', 'learner']).optional(), status: z.enum(['active', 'disabled']).optional() })
  .strict()
  .refine((body) => body.role !== undefined || body.status !== undefined, 'Role or status is required');

router.get(
  '/dashboard',
  asyncHandler(async (_request, response) => {
    const [users, activeLearners, courses, publishedCourses, draftCourses, attempts, passedAttempts, progressInFlight, completions, recentCourses] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'learner', status: 'active' }),
      Course.countDocuments(),
      Course.countDocuments({ status: 'published' }),
      Course.countDocuments({ status: 'draft' }),
      AssessmentAttempt.countDocuments(),
      AssessmentAttempt.countDocuments({ passed: true }),
      CourseProgress.countDocuments({ status: 'in_progress' }),
      CourseProgress.countDocuments({ status: 'completed' }),
      Course.find().select('code slug title status updatedAt').sort({ updatedAt: -1 }).limit(6).lean(),
    ]);
    const data = {
      users,
      totalUsers: users,
      activeLearners,
      courses,
      totalCourses: courses,
      publishedCourses,
      draftCourses,
      attempts,
      totalAttempts: attempts,
      passedAttempts,
      passRate: attempts ? Math.round((passedAttempts / attempts) * 10_000) / 100 : 0,
      progressInFlight,
      completions,
      recentCourses: recentCourses.map((course) => ({ ...course, id: course._id.toString(), _id: undefined })),
    };
    response.json({ data, dashboard: data });
  }),
);

router.get(
  '/users',
  asyncHandler(async (_request, response) => {
    const users = await User.find().sort({ createdAt: -1 }).limit(1_000);
    const data = users.map(userDto);
    response.json({ data, users: data });
  }),
);

router.patch(
  '/users/:id',
  validate({ params: idParams, body: userUpdate }),
  asyncHandler(async (request, response) => {
    const user = await User.findById(request.params.id);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    if (user._id.toString() === request.auth!.userId && (request.body.role === 'learner' || request.body.status === 'disabled')) {
      throw new AppError(409, 'SELF_LOCKOUT_PREVENTED', 'You cannot remove your own administrator access');
    }
    const previousRole = user.role;
    const previousStatus = user.status;
    if (request.body.role) user.role = request.body.role;
    if (request.body.status) user.status = request.body.status;
    await user.save();
    if (previousRole !== user.role) {
      await recordAudit(request, 'user.role_changed', 'user', user._id, { from: previousRole, to: user.role });
    }
    if (previousStatus !== user.status) {
      await recordAudit(request, 'user.status_changed', 'user', user._id, { from: previousStatus, to: user.status });
    }
    const data = userDto(user);
    response.json({ data, user: data });
  }),
);

router.get(
  '/progress',
  asyncHandler(async (_request, response) => {
    const progress = await CourseProgress.find()
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

async function resultsHandler(_request: any, response: any) {
  const attempts = await AssessmentAttempt.find()
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
}

router.get('/results', asyncHandler(resultsHandler));
router.get('/attempts', asyncHandler(resultsHandler));

async function exportResults(_request: any, response: any) {
  const attempts = await AssessmentAttempt.find()
    .populate('userId', 'name email')
    .populate('courseId', 'code title')
    .sort({ submittedAt: -1 });
  const rows = attempts.map((attempt: any) => [
    attempt._id,
    attempt.userId?.name,
    attempt.userId?.email,
    attempt.courseId?.code,
    attempt.courseId?.title,
    attempt.score,
    attempt.maximumScore,
    attempt.percentage,
    attempt.passed ? 'Passed' : 'Not passed',
    attempt.submittedAt,
  ]);
  response
    .status(200)
    .set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="itcp-training-results-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    })
    .send(makeCsv(['Attempt ID', 'Learner', 'Email', 'Course code', 'Course', 'Score', 'Maximum', 'Percentage', 'Result', 'Submitted'], rows));
}

router.get('/results/export', asyncHandler(exportResults));
router.get('/results.csv', asyncHandler(exportResults));

router.get(
  '/audit-logs',
  asyncHandler(async (_request, response) => {
    const logs = await AuditLog.find().populate('actorId', 'name email').sort({ createdAt: -1 }).limit(2_000);
    response.json({ data: logs });
  }),
);

export { router as adminRoutes, userUpdate as adminUserUpdateSchema };
