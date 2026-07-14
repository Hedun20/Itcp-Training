import bcrypt from 'bcryptjs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Types } from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import { connectDatabase } from '../src/config/database';
import { resetEnvForTests } from '../src/config/env';
import { compareStructuredTrainingContent } from '../src/data/trainingContentParity';
import { Course } from '../src/models/Course';
import { User } from '../src/models/User';
import { seedAdmin } from '../src/seeds/admin';
import { repairOriginalTrainingContent, seedCourses, structuredSeedCourses } from '../src/seeds/courses';

beforeAll(async () => {
  await connectDatabase();
});

describe('course migration', () => {
  it('preserves all four exact source courses as structured published-ready data', () => {
    const courses = structuredSeedCourses();
    const exactParity = compareStructuredTrainingContent(courses);
    expect(exactParity.sourceMatchesAuthoritativeManifest).toBe(true);
    expect(exactParity.exactMatch).toBe(true);
    expect(exactParity.courses.every((course) => course.exactMatch)).toBe(true);
    expect(courses.map((course) => course.code)).toEqual(['DCT-01', 'DCT-02', 'HSE-01', 'ACS-01']);
    expect(courses.map((course) => course.passMark)).toEqual([70, 75, 80, 75]);
    expect(courses.every((course) => course.estimatedDuration === '2–3 hrs')).toBe(true);
    expect(courses.map((course) => course.coverImage)).toEqual([
      '/course-placeholder-foundations.svg',
      '/course-placeholder-compliance.svg',
      '/course-placeholder-safety.svg',
      '/course-placeholder-practice.svg',
    ]);
    expect(
      courses.every((course) =>
        existsSync(path.resolve(__dirname, '../../client/public', course.coverImage!.replace(/^\//, ''))),
      ),
    ).toBe(true);
    expect(courses.reduce((sum, course) => sum + course.modules.length, 0)).toBe(24);
    const blocks = courses.flatMap((course) => course.modules.flatMap((module) => module.blocks));
    expect(blocks.filter((block) => block.type === 'paragraph')).toHaveLength(48);
    expect(blocks.filter((block) => block.type === 'image')).toHaveLength(4);
    expect(courses.reduce((sum, course) => sum + course.assessment.questions.length, 0)).toBe(40);
    expect(courses.reduce((sum, course) => sum + course.assessment.questions.flatMap((question) => question.options).length, 0)).toBe(160);
    expect(
      courses.every((course) => {
        const placeholder = course.modules[0]?.blocks.find((block) => block.type === 'image');
        return (
          placeholder?.layout === 'wide' &&
          placeholder.placeholder === true &&
          placeholder.altText?.includes('placeholder') &&
          placeholder.caption?.includes('placeholder') &&
          placeholder.credit?.includes('placeholder')
        );
      }),
    ).toBe(true);
  });

  it('stores the full authoritative content and placeholder images in MongoDB', async () => {
    const adminId = new Types.ObjectId();
    await seedCourses(adminId);
    const stored = await Course.find({ code: { $in: ['DCT-01', 'DCT-02', 'HSE-01', 'ACS-01'] } })
      .select('+assessment.questions.correctAnswer')
      .lean();
    const ordered = ['DCT-01', 'DCT-02', 'HSE-01', 'ACS-01'].map((code) =>
      stored.find((course) => course.code === code),
    );
    expect(ordered.every(Boolean)).toBe(true);
    expect(compareStructuredTrainingContent(ordered as any).exactMatch).toBe(true);
    expect(ordered.reduce((total, course) => total + course!.modules.length, 0)).toBe(24);
    expect(
      ordered.reduce(
        (total, course) =>
          total + course!.modules.reduce((moduleTotal, module) => moduleTotal + module.blocks.length, 0),
        0,
      ),
    ).toBe(52);
    expect(
      ordered.every(
        (course) =>
          course!.status === 'published' &&
          Boolean(course!.publishedAt) &&
          course!.modules.some((module) =>
            module.blocks.some((block) => block.type === 'image' && block.placeholder === true),
          ),
      ),
    ).toBe(true);
  });

  it('repairs missing canonical modules, blocks and questions without overwriting administrator content', async () => {
    const adminId = new Types.ObjectId();
    await seedCourses(adminId);
    const course = await Course.findOne({ code: 'DCT-01' }).select('+assessment.questions.correctAnswer');
    expect(course).toBeTruthy();
    const customParagraph = {
      type: 'paragraph' as const,
      text: 'Administrator-authored local note that must survive repair.',
    };
    const editedCanonicalText = 'Administrator-edited canonical paragraph that keeps its deterministic identifier.';
    course!.modules[0]!.blocks.push(customParagraph as any);
    const placeholder = course!.modules[0]!.blocks.find((block) => block.type === 'image');
    expect(placeholder).toBeTruthy();
    placeholder!.placeholder = false;
    placeholder!.url = '/uploads/administrator-approved-visual.png';
    course!.modules[1]!.blocks[0]!.text = editedCanonicalText;
    course!.modules[0]!.blocks.splice(0, 1);
    course!.modules.splice(5, 1);
    course!.assessment.questions[0]!.options.splice(1, 1);
    course!.assessment.questions.splice(9, 1);
    await course!.save();

    const repaired = await repairOriginalTrainingContent(adminId);
    const firstRun = repaired.courses.find((result) => result.code === 'DCT-01');
    expect(firstRun).toMatchObject({
      result: 'updated',
      insertedModules: 1,
      insertedBlocks: 3,
      updatedBlocks: 0,
      insertedQuestions: 1,
      updatedQuestions: 1,
    });

    const stored = await Course.findOne({ code: 'DCT-01' }).select('+assessment.questions.correctAnswer');
    const canonical = structuredSeedCourses().find((candidate) => candidate.code === 'DCT-01')!;
    expect(stored!.modules).toHaveLength(6);
    expect(stored!.modules.map((module) => module.title)).toEqual(canonical.modules.map((module) => module.title));
    expect(stored!.modules[0]!.blocks.some((block) => block.text === customParagraph.text)).toBe(true);
    expect(
      stored!.modules[0]!.blocks.filter((block) => block.type === 'paragraph').slice(0, 2).map((block) => block.text),
    ).toEqual(canonical.modules[0]!.blocks.filter((block) => block.type === 'paragraph').map((block) => block.text));
    const storedImage = stored!.modules[0]!.blocks.find((block) => block.type === 'image');
    expect(storedImage).toMatchObject({
      url: '/uploads/administrator-approved-visual.png',
      placeholder: false,
    });
    expect(stored!.modules[1]!.blocks[0]!.text).toBe(editedCanonicalText);
    expect(stored!.assessment.questions).toHaveLength(10);
    expect(stored!.assessment.questions.map((question) => question.questionText)).toEqual(
      canonical.assessment.questions.map((question) => question.questionText),
    );
    expect(stored!.assessment.questions[0]!.options).toEqual(canonical.assessment.questions[0]!.options);
    expect(stored!.assessment.questions[0]!.correctAnswer).toBe(canonical.assessment.questions[0]!.correctAnswer);

    const secondRun = await repairOriginalTrainingContent(adminId);
    expect(secondRun).toMatchObject({ inserted: 0, updated: 0, skipped: 4 });
  });

  it('restores middle-position damage to exact source parity and remains idempotent', async () => {
    const adminId = new Types.ObjectId();
    await seedCourses(adminId);
    const course = await Course.findOne({ code: 'DCT-02' }).select('+assessment.questions.correctAnswer');
    expect(course).toBeTruthy();
    course!.modules.splice(2, 1);
    course!.modules[0]!.blocks.splice(1, 1);
    course!.assessment.questions.splice(4, 1);
    const partialQuestion = course!.assessment.questions[0]!;
    const optionIndex = partialQuestion.correctAnswer === partialQuestion.options.length - 1
      ? 0
      : partialQuestion.options.length - 1;
    partialQuestion.options.splice(optionIndex, 1);
    if (optionIndex < partialQuestion.correctAnswer) partialQuestion.correctAnswer -= 1;
    await course!.save();

    const repaired = await repairOriginalTrainingContent(adminId);
    expect(repaired.courses.find((result) => result.code === 'DCT-02')).toMatchObject({
      result: 'updated',
      insertedModules: 1,
      insertedBlocks: 3,
      insertedQuestions: 1,
      updatedQuestions: 1,
    });
    const stored = await Course.find({ code: { $in: ['DCT-01', 'DCT-02', 'HSE-01', 'ACS-01'] } })
      .select('+assessment.questions.correctAnswer')
      .lean();
    const ordered = ['DCT-01', 'DCT-02', 'HSE-01', 'ACS-01'].map(
      (code) => stored.find((candidate) => candidate.code === code)!,
    );
    expect(compareStructuredTrainingContent(ordered as any).exactMatch).toBe(true);
    expect(await repairOriginalTrainingContent(adminId)).toMatchObject({ inserted: 0, updated: 0, skipped: 4 });
  });

  it('inserts missing courses by default, preserves CMS changes, and force-restores canonical content without duplicates', async () => {
    const adminId = new Types.ObjectId();
    await seedCourses(adminId);
    const first = await Course.findOne({ code: 'DCT-01' });
    expect(first).toBeTruthy();
    const firstModuleId = first!.modules[0]!._id.toString();
    const firstQuestionId = first!.assessment.questions[0]!._id.toString();
    first!.title = 'CMS-edited title';
    first!.status = 'archived';
    first!.modules[0]!.title = 'CMS-edited module';
    await first!.save();
    await Course.deleteOne({ code: 'ACS-01' });

    await seedCourses(adminId);
    const preserved = await Course.findOne({ code: 'DCT-01' });
    expect(await Course.countDocuments()).toBe(4);
    expect(preserved).toMatchObject({ title: 'CMS-edited title', status: 'archived' });
    expect(preserved!.modules[0]!.title).toBe('CMS-edited module');
    expect(await Course.exists({ code: 'ACS-01' })).toBeTruthy();

    await seedCourses(adminId, true);
    const restored = await Course.findOne({ code: 'DCT-01' });
    expect(await Course.countDocuments()).toBe(4);
    expect(restored).toMatchObject({ title: 'Data Centre Telecommunications — Foundations', status: 'published' });
    expect(restored!.modules[0]!.title).toBe('Data Centre Layout');
    expect(restored!.modules[0]!._id.toString()).toBe(firstModuleId);
    expect(restored!.assessment.questions[0]!._id.toString()).toBe(firstQuestionId);
  });
});

describe('administrator seed safety', () => {
  it('rejects a weak seed-only password without making it a runtime API prerequisite', async () => {
    const originalPassword = process.env.ADMIN_PASSWORD;
    try {
      process.env.ADMIN_PASSWORD = 'short';
      resetEnvForTests();
      await expect(seedAdmin()).rejects.toThrow('at least 12 characters');
    } finally {
      process.env.ADMIN_PASSWORD = originalPassword;
      resetEnvForTests();
    }
  });

  it('refuses to promote a matching learner account and leaves its password unchanged', async () => {
    const originalHash = await bcrypt.hash('LearnerOwned123!', 4);
    await User.create({
      name: 'Existing Learner',
      email: process.env.ADMIN_EMAIL,
      normalizedEmail: process.env.ADMIN_EMAIL,
      passwordHash: originalHash,
      role: 'learner',
      status: 'active',
    });
    await expect(seedAdmin()).rejects.toThrow('Refusing to promote existing non-admin account');
    const preserved = await User.findOne({ normalizedEmail: process.env.ADMIN_EMAIL }).select('+passwordHash');
    expect(preserved).toMatchObject({ role: 'learner', name: 'Existing Learner' });
    expect(preserved!.passwordHash).toBe(originalHash);
  });

  it('refreshes an existing admin with the configured password, name, and active status', async () => {
    await User.create({
      name: 'Old Admin Name',
      email: process.env.ADMIN_EMAIL,
      normalizedEmail: process.env.ADMIN_EMAIL,
      passwordHash: await bcrypt.hash('OldAdminPass123!', 4),
      role: 'admin',
      status: 'disabled',
    });
    await seedAdmin();
    const refreshed = await User.findOne({ normalizedEmail: process.env.ADMIN_EMAIL }).select('+passwordHash');
    expect(refreshed).toMatchObject({
      name: 'Configured Seed Administrator',
      role: 'admin',
      status: 'active',
    });
    expect(await bcrypt.compare(process.env.ADMIN_PASSWORD!, refreshed!.passwordHash!)).toBe(true);
    expect(await bcrypt.compare('OldAdminPass123!', refreshed!.passwordHash!)).toBe(false);
  });
});
