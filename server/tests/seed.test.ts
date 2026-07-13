import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import { connectDatabase } from '../src/config/database';
import { Course } from '../src/models/Course';
import { User } from '../src/models/User';
import { seedAdmin } from '../src/seeds/admin';
import { seedCourses, structuredSeedCourses } from '../src/seeds/courses';

beforeAll(async () => {
  await connectDatabase();
});

describe('course migration', () => {
  it('preserves all four exact source courses as structured published-ready data', () => {
    const courses = structuredSeedCourses();
    expect(courses.map((course) => course.code)).toEqual(['DCT-01', 'DCT-02', 'HSE-01', 'ACS-01']);
    expect(courses.map((course) => course.passMark)).toEqual([70, 75, 80, 75]);
    expect(courses.every((course) => course.estimatedDuration === '2–3 hrs')).toBe(true);
    expect(courses.map((course) => course.coverImage)).toEqual([
      '/course-placeholder-foundations.svg',
      '/course-placeholder-compliance.svg',
      '/course-placeholder-safety.svg',
      '/course-placeholder-practice.svg',
    ]);
    expect(courses.reduce((sum, course) => sum + course.modules.length, 0)).toBe(24);
    const blocks = courses.flatMap((course) => course.modules.flatMap((module) => module.blocks));
    expect(blocks.filter((block) => block.type === 'paragraph')).toHaveLength(48);
    expect(blocks.filter((block) => block.type === 'image')).toHaveLength(4);
    expect(courses.reduce((sum, course) => sum + course.assessment.questions.length, 0)).toBe(40);
    expect(courses.reduce((sum, course) => sum + course.assessment.questions.flatMap((question) => question.options).length, 0)).toBe(160);
    expect(
      courses.every((course) => {
        const placeholder = course.modules[0]?.blocks.find((block) => block.type === 'image');
        return placeholder?.layout === 'wide' && Boolean(placeholder.altText && placeholder.caption && placeholder.credit);
      }),
    ).toBe(true);
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
