import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AssessmentAttempt } from '../models/AssessmentAttempt';
import { Course } from '../models/Course';
import { CourseProgress } from '../models/CourseProgress';
import { attemptDto } from '../services/attemptService';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate);

const answerSchema = z.union([
  z.number().int().min(-1),
  z.object({
    questionId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    selectedOptionIndex: z.number().int().min(-1).optional(),
    answer: z.number().int().min(-1).optional(),
  }).refine((value) => value.selectedOptionIndex !== undefined || value.answer !== undefined, 'An answer index is required'),
]);
const submitBody = z.object({
  courseId: z.string().regex(/^[a-f\d]{24}$/i),
  answers: z.array(answerSchema).max(500),
});
const submitParams = z.object({ courseId: z.string().regex(/^[a-f\d]{24}$/i) });
const attemptParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });

router.get(
  ['/me', '/'],
  asyncHandler(async (request, response) => {
    const attempts = await AssessmentAttempt.find({ userId: request.auth!.userId })
      .populate('courseId', 'code slug title')
      .sort({ submittedAt: -1 });
    const data = attempts.map(attemptDto);
    response.json({ data, attempts: data });
  }),
);

router.get(
  '/:id',
  validate({ params: attemptParams }),
  asyncHandler(async (request, response) => {
    const attempt = await AssessmentAttempt.findOne({ _id: request.params.id, userId: request.auth!.userId })
      .populate('courseId', 'code slug title');
    if (!attempt) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Attempt not found');
    const data = attemptDto(attempt);
    response.json({ data, attempt: data });
  }),
);

async function submitAttempt(request: any, response: any) {
  const courseId = request.body.courseId ?? request.params.courseId;
  const course = await Course.findOne({ _id: courseId, status: 'published' })
    .select('+assessment.questions.correctAnswer');
  if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'Published course not found');
  if (!course.assessment.questions.length) throw new AppError(409, 'ASSESSMENT_UNAVAILABLE', 'Course has no assessment');

  const submitted = request.body.answers as Array<number | { questionId?: string; selectedOptionIndex?: number; answer?: number }>;
  if (submitted.length > course.assessment.questions.length) {
    throw new AppError(422, 'TOO_MANY_ANSWERS', 'Assessment contains more answers than questions');
  }
  const byQuestion = new Map<string, number>();
  submitted.forEach((entry, index) => {
    if (typeof entry === 'number') {
      const question = course.assessment.questions[index];
      if (question) byQuestion.set(question._id.toString(), entry);
      return;
    }
    const question = entry.questionId ? course.assessment.questions.find((candidate) => candidate._id.toString() === entry.questionId) : course.assessment.questions[index];
    if (!question) throw new AppError(422, 'INVALID_ANSWER', 'An answer references an unknown question');
    if (byQuestion.has(question._id.toString())) throw new AppError(422, 'DUPLICATE_ANSWER', 'Only one answer per question is allowed');
    byQuestion.set(question._id.toString(), entry.selectedOptionIndex ?? entry.answer ?? -1);
  });

  let score = 0;
  let maximumScore = 0;
  const answers = course.assessment.questions.map((question) => {
    const selectedOptionIndex = byQuestion.get(question._id.toString()) ?? -1;
    if (selectedOptionIndex >= question.options.length) {
      throw new AppError(422, 'INVALID_ANSWER', 'An answer index is outside the available options');
    }
    maximumScore += question.points;
    const pointsAwarded = selectedOptionIndex === question.correctAnswer ? question.points : 0;
    score += pointsAwarded;
    return {
      questionId: question._id,
      questionText: question.questionText,
      selectedOptionIndex,
      correctOptionIndex: question.correctAnswer,
      explanation: question.explanation,
      pointsAwarded,
    };
  });

  const rawPercentage = maximumScore === 0 ? 0 : (score / maximumScore) * 100;
  const percentage = Math.round(rawPercentage * 100) / 100;
  const passed = rawPercentage >= course.passMark;
  const now = new Date();
  const attempt = await AssessmentAttempt.create({
    userId: request.auth.userId,
    courseId: course._id,
    answers,
    score,
    maximumScore,
    percentage,
    passed,
    startedAt: now,
    submittedAt: now,
  });

  const progressUpdate: Record<string, any> = {
    $setOnInsert: {
      startedAt: now,
      currentModuleIndex: 0,
      completedModuleIds: [],
      status: 'in_progress',
    },
    $set: { lastAccessedAt: now },
    $max: { bestScore: percentage },
  };
  if (passed) progressUpdate.$set.passed = true;
  const progress = await CourseProgress.findOneAndUpdate(
    { userId: request.auth.userId, courseId: course._id },
    progressUpdate,
    { upsert: true, new: true },
  );
  const completedModuleIds = new Set(progress.completedModuleIds.map((id) => id.toString()));
  const allModulesComplete =
    course.modules.length > 0 && course.modules.every((module) => completedModuleIds.has(module._id.toString()));
  const isComplete = progress.passed && allModulesComplete;
  progress.status = isComplete ? 'completed' : 'in_progress';
  progress.completedAt = isComplete ? progress.completedAt ?? now : undefined;
  await progress.save();

  const data = attemptDto(attempt);
  response.status(201).json({ data, attempt: data });
}

router.post('/', validate({ body: submitBody }), asyncHandler(submitAttempt));
router.post(
  '/:courseId',
  validate({ params: submitParams, body: submitBody.omit({ courseId: true }) }),
  asyncHandler(submitAttempt),
);

export { router as attemptRoutes };
