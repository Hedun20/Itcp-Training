import type { ICourse } from '../models/Course';
import { AppError } from '../utils/AppError';

function plainCourse(course: any): Record<string, any> {
  return typeof course.toObject === 'function' ? course.toObject() : structuredClone(course);
}

export function courseDto(course: ICourse | any, includeAnswers = false): Record<string, any> {
  const value = plainCourse(course);
  value.id = value._id?.toString();
  delete value._id;
  value.summary = value.shortDescription;
  value.duration = value.estimatedDuration;
  value.modules = (value.modules ?? [])
    .sort((left: any, right: any) => left.order - right.order)
    .map((module: any) => ({
      ...module,
      id: module._id?.toString(),
      _id: undefined,
      blocks: (module.blocks ?? []).map((block: any) => ({ ...block, id: block._id?.toString(), _id: undefined })),
    }));
  value.assessment = {
    questions: (value.assessment?.questions ?? [])
      .sort((left: any, right: any) => left.order - right.order)
      .map((question: any) => {
        const result = {
          ...question,
          id: question._id?.toString(),
          _id: undefined,
          question: question.questionText,
          text: question.questionText,
        };
        if (!includeAnswers) {
          delete result.correctAnswer;
          delete result.explanation;
        }
        return result;
      }),
  };
  return value;
}

export function normalizeCourseIds(body: Record<string, any>): Record<string, any> {
  const result = { ...body };
  if (result.modules) {
    result.modules = result.modules.map((module: any) => ({
      ...module,
      ...(module._id || module.id ? { _id: module._id ?? module.id } : {}),
      id: undefined,
      blocks: (module.blocks ?? []).map((block: any) => ({
        ...block,
        ...(block._id || block.id ? { _id: block._id ?? block.id } : {}),
        id: undefined,
      })),
    }));
  }
  if (result.assessment?.questions) {
    result.assessment = {
      ...result.assessment,
      questions: result.assessment.questions.map((question: any) => ({
        ...question,
        ...(question._id || question.id ? { _id: question._id ?? question.id } : {}),
        id: undefined,
      })),
    };
  }
  return result;
}

export function assertPublishable(course: ICourse): void {
  const missing: string[] = [];
  for (const field of ['code', 'slug', 'title', 'shortDescription', 'description', 'estimatedDuration', 'category'] as const) {
    if (!course[field]?.trim()) missing.push(field);
  }
  if (course.passMark < 0 || course.passMark > 100) missing.push('passMark');
  if (!course.modules.length) missing.push('modules');
  if (!course.assessment.questions.length) missing.push('assessment.questions');

  course.modules.forEach((module, moduleIndex) => {
    if (!module.title.trim()) missing.push(`modules.${moduleIndex}.title`);
    module.blocks.forEach((block, blockIndex) => {
      const path = `modules.${moduleIndex}.blocks.${blockIndex}`;
      if (['heading', 'paragraph', 'callout'].includes(block.type) && !block.text?.trim()) missing.push(`${path}.text`);
      if (block.type === 'image' && (!block.url?.trim() || !block.altText?.trim())) missing.push(`${path}.image`);
      if (block.type === 'checklist' && !block.items?.some((item) => item.trim())) missing.push(`${path}.items`);
    });
  });

  course.assessment.questions.forEach((question, index) => {
    if (
      !question.questionText.trim() ||
      question.options.length < 2 ||
      question.options.some((option) => !option.trim()) ||
      !Number.isInteger(question.correctAnswer) ||
      question.correctAnswer < 0 ||
      question.correctAnswer >= question.options.length
    ) {
      missing.push(`assessment.questions.${index}.correctAnswer`);
    }
  });

  if (missing.length) {
    throw new AppError(422, 'COURSE_NOT_PUBLISHABLE', 'Course must pass publishing validation', { fields: missing });
  }
}
