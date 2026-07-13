import type { IAssessmentAttempt } from '../models/AssessmentAttempt';

export function attemptDto(attempt: IAssessmentAttempt | any) {
  const course = attempt.courseId && typeof attempt.courseId === 'object' && 'title' in attempt.courseId
    ? {
        id: attempt.courseId._id.toString(),
        code: attempt.courseId.code,
        slug: attempt.courseId.slug,
        title: attempt.courseId.title,
      }
    : undefined;
  return {
    id: attempt._id.toString(),
    userId: attempt.userId?._id?.toString?.() ?? attempt.userId.toString(),
    courseId: course?.id ?? attempt.courseId.toString(),
    ...(course ? { course } : {}),
    answers: attempt.answers.map((answer: any) => ({
      questionId: answer.questionId.toString(),
      selectedOptionIndex: answer.selectedOptionIndex,
      pointsAwarded: answer.pointsAwarded,
    })),
    score: attempt.score,
    maximumScore: attempt.maximumScore,
    percentage: attempt.percentage,
    passed: attempt.passed,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
  };
}
