import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import { getEnv } from '../config/env';
import { LEGACY_TRAININGS } from '../data/legacyTrainings';
import { Course } from '../models/Course';
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
                  altText: `Local visual placeholder for ${legacy.title}`,
                  caption: 'Locally supplied ITCP Training course visual.',
                  credit: 'ITCP Europe — local placeholder asset',
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

export async function seedCourses(adminId: Types.ObjectId, updateExisting = getEnv().SEED_UPDATE_EXISTING) {
  const courses = structuredSeedCourses();
  for (const course of courses) {
    const existing = await Course.findOne({ code: course.code }).select('publishedAt');
    if (existing && !updateExisting) {
      console.log(`Preserved existing ${course.code}; set SEED_UPDATE_EXISTING=true to restore canonical content`);
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
