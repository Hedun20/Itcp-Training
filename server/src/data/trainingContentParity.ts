import { createHash } from 'node:crypto';
import { LEGACY_TRAININGS } from './legacyTrainings';

// SHA-256 of the semantic projection recovered from
// C:\Dev\itcp-training.zip!itcp-training/src/data/trainings.js.
// It intentionally covers every source course/module/paragraph/question/option,
// answer index, duration and pass mark while ignoring formatting and comments.
export const AUTHORITATIVE_SOURCE_SEMANTIC_SHA256 = '6887d68e2c8dbfe95c2c9ac2376f56156a96787ef7d159ea7f7c639c1a496ad1';

export interface StructuredTrainingLike {
  code: string;
  slug: string;
  title: string;
  shortDescription: string;
  estimatedDuration: string;
  passMark: number;
  modules: ReadonlyArray<{
    title: string;
    blocks: ReadonlyArray<{ type: string; text?: string }>;
  }>;
  assessment: {
    questions: ReadonlyArray<{
      questionText: string;
      options: ReadonlyArray<string>;
      correctAnswer?: number;
    }>;
  };
}

export interface LegacyProjection {
  id: string;
  code: string;
  title: string;
  duration: string;
  summary: string;
  passMark: number;
  modules: ReadonlyArray<{ title: string; body: ReadonlyArray<string> }>;
  quiz: ReadonlyArray<{ q: string; options: ReadonlyArray<string>; answer: number | undefined }>;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function prototypeTrainingProjection(trainings: ReadonlyArray<LegacyProjection>): LegacyProjection[] {
  return trainings.map((training) => ({
    id: training.id,
    code: training.code,
    title: training.title,
    duration: training.duration,
    summary: training.summary,
    passMark: training.passMark,
    modules: training.modules.map((module) => ({ title: module.title, body: [...module.body] })),
    quiz: training.quiz.map((question) => ({
      q: question.q,
      options: [...question.options],
      answer: question.answer,
    })),
  }));
}

export function authoritativeTrainingProjection(): LegacyProjection[] {
  return prototypeTrainingProjection(LEGACY_TRAININGS);
}

export function comparePrototypeTrainingContent(trainings: ReadonlyArray<LegacyProjection>) {
  const authoritative = authoritativeTrainingProjection();
  const prototype = prototypeTrainingProjection(trainings);
  const authoritativeSha256 = sha256(authoritative);
  const prototypeSha256 = sha256(prototype);
  return {
    exactMatch: JSON.stringify(authoritative) === JSON.stringify(prototype),
    authoritativeSha256,
    prototypeSha256,
    manifestSha256: AUTHORITATIVE_SOURCE_SEMANTIC_SHA256,
    authoritativeMatchesManifest: authoritativeSha256 === AUTHORITATIVE_SOURCE_SEMANTIC_SHA256,
    prototypeMatchesManifest: prototypeSha256 === AUTHORITATIVE_SOURCE_SEMANTIC_SHA256,
    authoritativeTotals: trainingProjectionTotals(authoritative),
    prototypeTotals: trainingProjectionTotals(prototype),
  };
}

export function structuredTrainingProjection(courses: ReadonlyArray<StructuredTrainingLike>): LegacyProjection[] {
  return courses.map((course) => ({
    id: course.slug,
    code: course.code,
    title: course.title,
    duration: course.estimatedDuration,
    summary: course.shortDescription,
    passMark: course.passMark,
    modules: course.modules.map((module) => ({
      title: module.title,
      body: module.blocks
        .filter((block) => block.type === 'paragraph')
        .map((block) => block.text ?? ''),
    })),
    quiz: course.assessment.questions.map((question) => ({
      q: question.questionText,
      options: [...question.options],
      answer: question.correctAnswer,
    })),
  }));
}

export function trainingProjectionTotals(courses: ReadonlyArray<LegacyProjection>) {
  return {
    courses: courses.length,
    modules: courses.reduce((total, course) => total + course.modules.length, 0),
    paragraphs: courses.reduce(
      (total, course) => total + course.modules.reduce((moduleTotal, module) => moduleTotal + module.body.length, 0),
      0,
    ),
    questions: courses.reduce((total, course) => total + course.quiz.length, 0),
    answerOptions: courses.reduce(
      (total, course) => total + course.quiz.reduce((quizTotal, question) => quizTotal + question.options.length, 0),
      0,
    ),
  };
}

export function compareStructuredTrainingContent(courses: ReadonlyArray<StructuredTrainingLike>) {
  const source = authoritativeTrainingProjection();
  const structured = structuredTrainingProjection(courses);
  const sourceByCode = new Map(source.map((course) => [course.code, course]));
  const structuredByCode = new Map(structured.map((course) => [course.code, course]));
  const allCodes = [...new Set([...sourceByCode.keys(), ...structuredByCode.keys()])];
  const sourceSha256 = sha256(source);
  const structuredSha256 = sha256(structured);

  return {
    exactMatch: JSON.stringify(source) === JSON.stringify(structured),
    sourceMatchesAuthoritativeManifest: sourceSha256 === AUTHORITATIVE_SOURCE_SEMANTIC_SHA256,
    sourceSha256,
    structuredSha256,
    sourceTotals: trainingProjectionTotals(source),
    structuredTotals: trainingProjectionTotals(structured),
    courses: allCodes.map((code) => {
      const expected = sourceByCode.get(code);
      const actual = structuredByCode.get(code);
      return {
        code,
        presentInSource: Boolean(expected),
        presentInStructuredContent: Boolean(actual),
        exactMatch: Boolean(expected && actual && JSON.stringify(expected) === JSON.stringify(actual)),
        sourceSha256: expected ? sha256(expected) : null,
        structuredSha256: actual ? sha256(actual) : null,
      };
    }),
  };
}
