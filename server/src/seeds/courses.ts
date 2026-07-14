import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import { getEnv } from '../config/env';
import { LEGACY_TRAININGS } from '../data/legacyTrainings';
import { Course, type CourseDocument } from '../models/Course';
import { createCourseSchema } from '../validation/courseSchemas';

const categories: Record<string, string> = {
  'DCT-01': 'Data Centre Telecommunications',
  'DCT-02': 'Data Centre Telecommunications',
  'HSE-01': 'Health & Safety',
  'ACS-01': 'Access Control',
};

const tags: Record<string, string[]> = {
  'DCT-01': ['data-centre', 'telecommunications', 'cabling', 'foundations'],
  'DCT-02': ['data-centre', 'testing', 'certification', 'fibre', 'copper'],
  'HSE-01': ['health-and-safety', 'site-safety', 'rams', 'ppe'],
  'ACS-01': ['access-control', 'physical-security', 'doors', 'infrastructure'],
};

const coverImages: Record<string, string> = {
  'DCT-01': '/course-placeholder-foundations.svg',
  'DCT-02': '/course-placeholder-compliance.svg',
  'HSE-01': '/course-placeholder-safety.svg',
  'ACS-01': '/course-placeholder-practice.svg',
};

export function structuredSeedCourses() {
  const stableId = (...parts: Array<string | number>) =>
    createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 24);
  return LEGACY_TRAININGS.map((legacy) =>
    createCourseSchema.parse({
      code: legacy.code,
      slug: legacy.id,
      title: legacy.title,
      shortDescription: legacy.summary,
      description: legacy.summary,
      coverImage: coverImages[legacy.code],
      estimatedDuration: legacy.duration,
      passMark: legacy.passMark,
      category: categories[legacy.code],
      tags: tags[legacy.code],
      modules: legacy.modules.map((module, moduleIndex) => ({
        _id: stableId(legacy.code, 'module', moduleIndex),
        title: module.title,
        order: moduleIndex,
        blocks: [
          ...module.body.map((paragraph, blockIndex) => ({
            _id: stableId(legacy.code, 'module', moduleIndex, 'block', blockIndex),
            type: 'paragraph' as const,
            text: paragraph,
          })),
          ...(moduleIndex === 0
            ? [
                {
                  _id: stableId(legacy.code, 'module', moduleIndex, 'local-placeholder'),
                  type: 'image' as const,
                  url: coverImages[legacy.code],
                  altText: `Neutral local training placeholder for ${legacy.title}`,
                  caption: 'Neutral training placeholder — replace only with an approved course visual.',
                  credit: 'ITCP Europe — local placeholder asset',
                  placeholder: true,
                  layout: 'wide' as const,
                },
              ]
            : []),
        ],
      })),
      assessment: {
        questions: legacy.quiz.map((question, questionIndex) => ({
          _id: stableId(legacy.code, 'question', questionIndex),
          questionText: question.q,
          options: [...question.options],
          correctAnswer: question.answer,
          points: 1,
          order: questionIndex,
        })),
      },
    }),
  );
}

type StructuredSeedCourse = ReturnType<typeof structuredSeedCourses>[number];
type SeedModule = StructuredSeedCourse['modules'][number];
type SeedBlock = SeedModule['blocks'][number];
type SeedQuestion = StructuredSeedCourse['assessment']['questions'][number];

export interface CourseContentRepairResult {
  code: string;
  result: 'inserted' | 'updated' | 'skipped';
  insertedModules: number;
  insertedBlocks: number;
  updatedBlocks: number;
  insertedQuestions: number;
  updatedQuestions: number;
  restoredCoverImage: boolean;
  restoredPublishedAt: boolean;
  preservedModules: number;
  preservedBlocks: number;
  preservedQuestions: number;
}

export interface OriginalContentRepairReport {
  inserted: number;
  updated: number;
  skipped: number;
  courses: CourseContentRepairResult[];
}

function identifier(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toString' in value) return String(value);
  return undefined;
}

function sameIdentifier(left: unknown, right: unknown): boolean {
  const leftId = identifier(left);
  const rightId = identifier(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

function findCanonicalModule(existingModules: any[], canonical: SeedModule) {
  const byId = existingModules.find((module) => sameIdentifier(module._id, canonical._id));
  if (byId) return byId;

  const byTitle = existingModules.find((module) => module.title === canonical.title);
  if (byTitle) return byTitle;

  const canonicalParagraphs = new Set(
    canonical.blocks.filter((block) => block.type === 'paragraph').map((block) => block.text),
  );
  return existingModules.find((module) =>
    module.blocks?.some((block: any) => block.type === 'paragraph' && canonicalParagraphs.has(block.text)),
  );
}

function findCanonicalBlock(existingBlocks: any[], canonical: SeedBlock) {
  const byId = existingBlocks.find((block) => sameIdentifier(block._id, canonical._id));
  if (byId) return byId;
  if (canonical.type === 'paragraph') {
    return existingBlocks.find((block) => block.type === 'paragraph' && block.text === canonical.text);
  }
  if (canonical.type === 'image') {
    return existingBlocks.find((block) => block.type === 'image' && block.url === canonical.url);
  }
  return undefined;
}

function findCanonicalQuestion(existingQuestions: any[], canonical: SeedQuestion) {
  const byId = existingQuestions.find((question) => sameIdentifier(question._id, canonical._id));
  if (byId) return byId;
  return existingQuestions.find((question) => question.questionText === canonical.questionText);
}

function emptyRepairResult(code: string): CourseContentRepairResult {
  return {
    code,
    result: 'skipped',
    insertedModules: 0,
    insertedBlocks: 0,
    updatedBlocks: 0,
    insertedQuestions: 0,
    updatedQuestions: 0,
    restoredCoverImage: false,
    restoredPublishedAt: false,
    preservedModules: 0,
    preservedBlocks: 0,
    preservedQuestions: 0,
  };
}

function canonicalInsertionIndex<TExisting, TCanonical>(
  existing: TExisting[],
  canonical: TCanonical[],
  canonicalIndex: number,
  find: (items: TExisting[], item: TCanonical) => TExisting | undefined,
): number {
  for (let index = canonicalIndex + 1; index < canonical.length; index += 1) {
    const next = find(existing, canonical[index]!);
    if (next) return existing.indexOf(next);
  }
  for (let index = canonicalIndex - 1; index >= 0; index -= 1) {
    const previous = find(existing, canonical[index]!);
    if (previous) return existing.indexOf(previous) + 1;
  }
  return Math.min(canonicalIndex, existing.length);
}

function isOrderedSubset(values: string[], canonical: string[]): boolean {
  let canonicalIndex = 0;
  for (const value of values) {
    while (canonicalIndex < canonical.length && canonical[canonicalIndex] !== value) canonicalIndex += 1;
    if (canonicalIndex >= canonical.length) return false;
    canonicalIndex += 1;
  }
  return true;
}

function repairCanonicalQuestion(existing: any, canonical: SeedQuestion): boolean {
  const existingOptions = Array.isArray(existing.options) ? [...existing.options] : [];
  const canonicalOptions = [...canonical.options];

  if (
    existingOptions.length < canonicalOptions.length &&
    isOrderedSubset(existingOptions, canonicalOptions)
  ) {
    existing.options = canonicalOptions;
    existing.correctAnswer = canonical.correctAnswer;
    return true;
  }

  let changed = false;
  for (let canonicalIndex = 0; canonicalIndex < canonicalOptions.length; canonicalIndex += 1) {
    const option = canonicalOptions[canonicalIndex]!;
    if (existingOptions.includes(option)) continue;
    const insertionIndex = canonicalInsertionIndex(
      existingOptions,
      canonicalOptions,
      canonicalIndex,
      (items, candidate) => items.find((item) => item === candidate),
    );
    existingOptions.splice(insertionIndex, 0, option);
    changed = true;
  }

  if (changed) existing.options = existingOptions;
  if (
    !Number.isInteger(existing.correctAnswer) ||
    existing.correctAnswer < 0 ||
    existing.correctAnswer >= existingOptions.length
  ) {
    const correctOption = canonicalOptions[canonical.correctAnswer];
    const restoredIndex = correctOption === undefined ? -1 : existingOptions.indexOf(correctOption);
    if (restoredIndex >= 0) {
      existing.correctAnswer = restoredIndex;
      changed = true;
    }
  }
  return changed;
}

async function insertCanonicalCourse(adminId: Types.ObjectId, canonical: StructuredSeedCourse) {
  await Course.create({
    ...canonical,
    status: 'published',
    publishedAt: new Date(),
    createdBy: adminId,
    updatedBy: adminId,
  });
  return {
    ...emptyRepairResult(canonical.code),
    result: 'inserted' as const,
    insertedModules: canonical.modules.length,
    insertedBlocks: canonical.modules.reduce((total, module) => total + module.blocks.length, 0),
    insertedQuestions: canonical.assessment.questions.length,
    restoredCoverImage: Boolean(canonical.coverImage),
    restoredPublishedAt: true,
  };
}

async function repairExistingCourse(
  existing: CourseDocument,
  canonical: StructuredSeedCourse,
  adminId: Types.ObjectId,
): Promise<CourseContentRepairResult> {
  const result = emptyRepairResult(canonical.code);
  const plain = existing.toObject({ depopulate: true }) as any;
  const modules: any[] = plain.modules ?? [];
  const questions: any[] = plain.assessment?.questions ?? [];

  for (let moduleIndex = 0; moduleIndex < canonical.modules.length; moduleIndex += 1) {
    const canonicalModule = canonical.modules[moduleIndex]!;
    const existingModule = findCanonicalModule(modules, canonicalModule);
    if (!existingModule) {
      const insertionIndex = canonicalInsertionIndex(
        modules,
        canonical.modules,
        moduleIndex,
        findCanonicalModule,
      );
      modules.splice(insertionIndex, 0, canonicalModule);
      result.insertedModules += 1;
      result.insertedBlocks += canonicalModule.blocks.length;
      continue;
    }

    result.preservedModules += 1;
    existingModule.blocks ??= [];
    for (let blockIndex = 0; blockIndex < canonicalModule.blocks.length; blockIndex += 1) {
      const canonicalBlock = canonicalModule.blocks[blockIndex]!;
      const existingBlock = findCanonicalBlock(existingModule.blocks, canonicalBlock);
      if (existingBlock) {
        result.preservedBlocks += 1;
        if (
          canonicalBlock.type === 'image' &&
          canonicalBlock.placeholder &&
          existingBlock.url === canonicalBlock.url &&
          existingBlock.placeholder !== true
        ) {
          existingBlock.placeholder = true;
          result.updatedBlocks += 1;
        }
      } else {
        const insertionIndex = canonicalInsertionIndex(
          existingModule.blocks,
          canonicalModule.blocks,
          blockIndex,
          findCanonicalBlock,
        );
        existingModule.blocks.splice(insertionIndex, 0, canonicalBlock);
        result.insertedBlocks += 1;
      }
    }
  }

  for (let questionIndex = 0; questionIndex < canonical.assessment.questions.length; questionIndex += 1) {
    const canonicalQuestion = canonical.assessment.questions[questionIndex]!;
    const existingQuestion = findCanonicalQuestion(questions, canonicalQuestion);
    if (existingQuestion) {
      result.preservedQuestions += 1;
      if (repairCanonicalQuestion(existingQuestion, canonicalQuestion)) result.updatedQuestions += 1;
    } else {
      const insertionIndex = canonicalInsertionIndex(
        questions,
        canonical.assessment.questions,
        questionIndex,
        findCanonicalQuestion,
      );
      questions.splice(insertionIndex, 0, canonicalQuestion);
      result.insertedQuestions += 1;
    }
  }

  const updates: Record<string, unknown> = {};
  if (result.insertedModules || result.insertedBlocks || result.updatedBlocks) updates.modules = modules;
  if (result.insertedQuestions || result.updatedQuestions) updates['assessment.questions'] = questions;
  if (!existing.coverImage && canonical.coverImage) {
    updates.coverImage = canonical.coverImage;
    result.restoredCoverImage = true;
  }
  if (existing.status === 'published' && !existing.publishedAt) {
    updates.publishedAt = new Date();
    result.restoredPublishedAt = true;
  }

  if (Object.keys(updates).length === 0) return result;
  updates.updatedBy = adminId;
  await Course.updateOne({ _id: existing._id }, { $set: updates }, { runValidators: true });
  result.result = 'updated';
  return result;
}

async function repairCanonicalCourse(adminId: Types.ObjectId, canonical: StructuredSeedCourse) {
  const existing = await Course.findOne({ code: canonical.code }).select('+assessment.questions.correctAnswer');
  if (!existing) return insertCanonicalCourse(adminId, canonical);
  return repairExistingCourse(existing, canonical, adminId);
}

export async function repairOriginalTrainingContent(adminId: Types.ObjectId): Promise<OriginalContentRepairReport> {
  const courses: CourseContentRepairResult[] = [];
  for (const canonical of structuredSeedCourses()) {
    courses.push(await repairCanonicalCourse(adminId, canonical));
  }
  return {
    inserted: courses.filter((course) => course.result === 'inserted').length,
    updated: courses.filter((course) => course.result === 'updated').length,
    skipped: courses.filter((course) => course.result === 'skipped').length,
    courses,
  };
}

export async function seedCourses(adminId: Types.ObjectId, updateExisting = getEnv().SEED_UPDATE_EXISTING) {
  const courses = structuredSeedCourses();
  for (const course of courses) {
    const existing = await Course.findOne({ code: course.code }).select('+assessment.questions.correctAnswer');
    if (existing && !updateExisting) {
      const repair = await repairExistingCourse(existing, course, adminId);
      console.log(
        repair.result === 'updated'
          ? `Repaired ${course.code}: added ${repair.insertedModules} modules, ${repair.insertedBlocks} blocks and ${repair.insertedQuestions} questions; updated ${repair.updatedBlocks} block markers and ${repair.updatedQuestions} partial questions while preserving existing edits`
          : `Preserved existing ${course.code}; canonical modules, blocks and questions are already present`,
      );
      continue;
    }
    await Course.findOneAndUpdate(
      { code: course.code },
      {
        $set: {
          ...course,
          status: 'published',
          publishedAt: existing?.publishedAt ?? new Date(),
          updatedBy: adminId,
        },
        $setOnInsert: {
          createdBy: adminId,
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    console.log(`${existing ? 'Updated' : 'Inserted'} ${course.code}: ${course.title}`);
  }
  return courses.length;
}
