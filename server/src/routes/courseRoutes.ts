import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Course } from '../models/Course';
import { recordAudit } from '../services/auditService';
import { assertPublishable, courseDto, normalizeCourseIds } from '../services/courseService';
import { sanitizeCourseProgressRecords } from '../services/progressService';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import {
  courseListQuerySchema,
  createCourseSchema,
  identifierParamsSchema,
  updateCourseSchema,
} from '../validation/courseSchemas';

const router = Router();
router.use(authenticate);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get(
  '/',
  validate({ query: courseListQuerySchema }),
  asyncHandler(async (request, response) => {
    const { search, status, page, limit } = request.query as any;
    const filter: Record<string, unknown> = request.auth!.role === 'admin' ? {} : { status: 'published' };
    if (request.auth!.role === 'admin' && status) filter.status = status;
    if (search) {
      const safeSearch = escapeRegExp(search);
      filter.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { code: { $regex: safeSearch, $options: 'i' } },
        { shortDescription: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    const courseQuery = Course.find(filter);
    if (request.auth!.role === 'admin') courseQuery.select('+assessment.questions.correctAnswer');
    const [courses, total] = await Promise.all([
      courseQuery
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Course.countDocuments(filter),
    ]);
    const data = courses.map((course) => courseDto(course, request.auth!.role === 'admin'));
    response.json({ data, courses: data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  }),
);

router.get(
  '/:id',
  validate({ params: identifierParamsSchema }),
  asyncHandler(async (request, response) => {
    const identifier = request.params.id as string;
    const selector = isValidObjectId(identifier) ? { _id: identifier } : { slug: identifier.toLowerCase() };
    const filter = request.auth!.role === 'admin' ? selector : { ...selector, status: 'published' };
    const query = Course.findOne(filter);
    if (request.auth!.role === 'admin') query.select('+assessment.questions.correctAnswer');
    const course = await query;
    if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found');
    const data = courseDto(course, request.auth!.role === 'admin');
    response.json({ data, course: data });
  }),
);

router.post(
  '/',
  requireRole('admin'),
  validate({ body: createCourseSchema }),
  asyncHandler(async (request, response) => {
    const course = await Course.create({
      ...normalizeCourseIds(request.body),
      status: 'draft',
      createdBy: request.auth!.userId,
      updatedBy: request.auth!.userId,
    });
    await recordAudit(request, 'course.created', 'course', course._id, { code: course.code });
    const data = courseDto(course, true);
    response.status(201).json({ data, course: data });
  }),
);

router.patch(
  '/:id',
  requireRole('admin'),
  validate({ params: identifierParamsSchema, body: updateCourseSchema }),
  asyncHandler(async (request, response) => {
    const course = await Course.findById(request.params.id).select('+assessment.questions.correctAnswer');
    if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found');
    if (course.status === 'archived') throw new AppError(409, 'COURSE_ARCHIVED', 'Archived courses cannot be edited');
    const previousModuleIds = course.modules.map((module) => module._id.toString());
    const modulesChanged = request.body.modules !== undefined;
    course.set({ ...normalizeCourseIds(request.body), updatedBy: request.auth!.userId });
    if (course.status === 'published') assertPublishable(course);
    await course.save();
    if (modulesChanged) {
      await sanitizeCourseProgressRecords(
        course._id.toString(),
        previousModuleIds,
        course.modules.map((module) => module._id.toString()),
      );
    }
    await recordAudit(request, 'course.updated', 'course', course._id, { fields: Object.keys(request.body) });
    const data = courseDto(course, true);
    response.json({ data, course: data });
  }),
);

router.post(
  '/:id/publish',
  requireRole('admin'),
  validate({ params: identifierParamsSchema }),
  asyncHandler(async (request, response) => {
    const course = await Course.findById(request.params.id).select('+assessment.questions.correctAnswer');
    if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found');
    if (course.status === 'archived') throw new AppError(409, 'COURSE_ARCHIVED', 'Archived courses cannot be published');
    assertPublishable(course);
    course.status = 'published';
    course.publishedAt = new Date();
    course.updatedBy = request.user!._id;
    await course.save();
    await recordAudit(request, 'course.published', 'course', course._id);
    const data = courseDto(course, true);
    response.json({ data, course: data });
  }),
);

router.post(
  '/:id/unpublish',
  requireRole('admin'),
  validate({ params: identifierParamsSchema }),
  asyncHandler(async (request, response) => {
    const course = await Course.findById(request.params.id).select('+assessment.questions.correctAnswer');
    if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found');
    if (course.status === 'archived') throw new AppError(409, 'COURSE_ARCHIVED', 'Archived courses cannot be unpublished');
    course.status = 'draft';
    course.updatedBy = request.user!._id;
    await course.save();
    await recordAudit(request, 'course.unpublished', 'course', course._id);
    const data = courseDto(course, true);
    response.json({ data, course: data });
  }),
);

router.post(
  '/:id/archive',
  requireRole('admin'),
  validate({ params: identifierParamsSchema }),
  asyncHandler(async (request, response) => {
    const course = await Course.findById(request.params.id).select('+assessment.questions.correctAnswer');
    if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found');
    course.status = 'archived';
    course.updatedBy = request.user!._id;
    await course.save();
    await recordAudit(request, 'course.archived', 'course', course._id);
    const data = courseDto(course, true);
    response.json({ data, course: data });
  }),
);

export { router as courseRoutes };
