import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import mongoose from 'mongoose';
import request, { type Response as SupertestResponse } from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { connectDatabase } from '../src/config/database';
import { getEnv } from '../src/config/env';
import { MediaAsset } from '../src/models/MediaAsset';
import { RefreshToken } from '../src/models/RefreshToken';
import { User } from '../src/models/User';
import { seedCourses } from '../src/seeds/courses';

let app: Express;

function firstSetCookie(response: SupertestResponse): string {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error('Expected a Set-Cookie response header');
  const cookie = value.split(';')[0];
  if (!cookie) throw new Error('Expected a cookie value');
  return cookie;
}

beforeAll(async () => {
  await connectDatabase();
  app = createApp();
});

async function register(email = 'learner@example.com') {
  const response = await request(app).post('/api/v1/auth/register').send({
    name: 'Test Learner',
    email,
    password: 'SecurePass123!',
    role: 'learner',
  });
  return { response, token: response.body.accessToken as string, user: response.body.user };
}

async function createAdmin(email = 'admin@example.com') {
  await User.create({
    name: 'Test Admin',
    email,
    normalizedEmail: email,
    passwordHash: await bcrypt.hash('AdminPass123!', 4),
    role: 'admin',
    status: 'active',
  });
  const response = await request(app).post('/api/v1/auth/login').send({ email, password: 'AdminPass123!' });
  return response.body.accessToken as string;
}

function coursePayload(slug = 'secure-course') {
  return {
    code: `T-${slug.slice(-8)}`,
    slug,
    title: 'Secure course',
    shortDescription: 'A sufficiently long short course description.',
    description: 'A sufficiently long full course description.',
    estimatedDuration: '1 hr',
    passMark: 60,
    category: 'Testing',
    tags: ['testing'],
    modules: [
      {
        title: 'Module one',
        order: 0,
        blocks: [{ type: 'paragraph', text: 'Learner-safe structured content.' }],
      },
    ],
    assessment: {
      questions: [
        {
          questionText: 'Select the second answer',
          options: ['Wrong', 'Right'],
          correctAnswer: 1,
          explanation: 'The second option is correct.',
          points: 2,
          order: 0,
        },
        {
          questionText: 'Select the first answer',
          options: ['Right', 'Wrong'],
          correctAnswer: 0,
          points: 1,
          order: 1,
        },
      ],
    },
  };
}

async function createAndPublishCourse(adminToken: string, slug = 'secure-course') {
  const created = await request(app)
    .post('/api/v1/courses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(coursePayload(slug));
  expect(created.status).toBe(201);
  const published = await request(app)
    .post(`/api/v1/courses/${created.body.course.id}/publish`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(published.status).toBe(200);
  return published.body.course;
}

describe('authentication', () => {
  it('registers only learners, normalizes email, hashes the password, and returns a request id', async () => {
    const { response, user } = await register('Learner@Example.COM');
    expect(response.status).toBe(201);
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(user).toMatchObject({ email: 'learner@example.com', role: 'learner', status: 'active' });
    const stored = await User.findOne({ normalizedEmail: 'learner@example.com' }).select('+passwordHash');
    expect(stored?.passwordHash).toBeTruthy();
    expect(stored?.passwordHash).not.toBe('SecurePass123!');
    const setCookieHeader = response.headers['set-cookie'];
    expect(Array.isArray(setCookieHeader) ? setCookieHeader.join(';') : setCookieHeader).toContain('HttpOnly');
  });

  it('rejects registration passwords that do not meet the shared letter-and-digit policy', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Weak Password',
      email: 'weak@example.com',
      password: 'OnlyLetters!',
    });
    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(JSON.stringify(response.body.error.details)).toContain('at least one digit');
  });

  it('logs in with bcrypt credentials and rejects an incorrect password generically', async () => {
    await register();
    const good = await request(app).post('/api/v1/auth/login').send({
      email: 'LEARNER@example.com',
      password: 'SecurePass123!',
    });
    expect(good.status).toBe(200);
    expect(good.body.accessToken).toBeTruthy();
    const bad = await request(app).post('/api/v1/auth/login').send({
      email: 'learner@example.com',
      password: 'definitely-wrong',
    });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rotates refresh tokens, stores only digests, and revokes logout tokens', async () => {
    const registration = await register();
    const firstCookie = firstSetCookie(registration.response);
    const rawFirst = firstCookie.split('=')[1]!;
    const storedFirst = await RefreshToken.findOne().select('+tokenHash');
    expect(storedFirst?.tokenHash).not.toBe(rawFirst);

    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie);
    expect(refresh.status).toBe(200);
    const secondCookie = firstSetCookie(refresh);
    expect(secondCookie).not.toBe(firstCookie);

    expect((await request(app).post('/api/v1/auth/logout').set('Cookie', secondCookie)).status).toBe(204);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', secondCookie)).status).toBe(401);
  });

  it('keeps the winning refresh valid during a same-client race, then revokes the family on later reuse', async () => {
    const registration = await register('refresh-race@example.com');
    const firstCookie = firstSetCookie(registration.response);
    const original = await RefreshToken.findOne();
    expect(original).toBeTruthy();

    const responses = await Promise.all([
      request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie),
      request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie),
    ]);
    const winner = responses.find((response) => response.status === 200);
    const loser = responses.find((response) => response.status === 409);
    expect(winner).toBeTruthy();
    expect(loser?.body.error).toMatchObject({
      code: 'REFRESH_RACE_RETRY',
      details: { retryable: true },
    });
    expect(loser?.headers['set-cookie']).toBeUndefined();
    expect(await RefreshToken.countDocuments({ revokedAt: { $exists: false } })).toBe(1);

    const winnerCookie = firstSetCookie(winner!);
    const nextRefresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', winnerCookie);
    expect(nextRefresh.status).toBe(200);
    const newestCookie = firstSetCookie(nextRefresh);

    await RefreshToken.updateOne(
      { _id: original!._id },
      { $set: { revokedAt: new Date(Date.now() - 10_000) } },
    );
    const laterReuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie);
    expect(laterReuse.status).toBe(401);
    expect(laterReuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', newestCookie)).status).toBe(401);
  });

  it('keeps Google OAuth controlled-disabled without credentials', async () => {
    expect(getEnv().COOKIE_SECURE).toBeUndefined();
    expect(getEnv().SEED_UPDATE_EXISTING).toBe(false);
    expect(getEnv().uploadsDirectory).toBe(process.env.UPLOADS_DIRECTORY);
    const status = await request(app).get('/api/v1/auth/google/status');
    expect(status.body.enabled).toBe(false);
    const start = await request(app).get('/api/v1/auth/google');
    expect(start.status).toBe(503);
    expect(start.body.error.code).toBe('GOOGLE_AUTH_UNAVAILABLE');
  });
});

describe('authorization and courses', () => {
  it('blocks learners from admin endpoints and permits admin course creation', async () => {
    const learner = await register();
    const forbidden = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${learner.token}`);
    expect(forbidden.status).toBe(403);

    const adminToken = await createAdmin();
    const dashboard = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dashboard.body.dashboard).toMatchObject({ totalUsers: 2, draftCourses: 0, completions: 0, totalAttempts: 0, recentCourses: [] });
    const created = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(coursePayload());
    expect(created.status).toBe(201);
    expect(created.body.course.status).toBe('draft');
    const literalRegexSearch = await request(app)
      .get('/api/v1/courses?search=.*')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(literalRegexSearch.status).toBe(200);
    expect(literalRegexSearch.body.courses).toHaveLength(0);
  });

  it('hides drafts from list and direct learner access', async () => {
    const learner = await register();
    const adminToken = await createAdmin();
    const created = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(coursePayload('hidden-draft'));
    expect(created.status).toBe(201);
    const list = await request(app).get('/api/v1/courses').set('Authorization', `Bearer ${learner.token}`);
    expect(list.body.courses).toHaveLength(0);
    const detail = await request(app)
      .get('/api/v1/courses/hidden-draft')
      .set('Authorization', `Bearer ${learner.token}`);
    expect(detail.status).toBe(404);
  });

  it('saves incomplete drafts but refuses to publish them', async () => {
    const adminToken = await createAdmin();
    const incomplete = {
      ...coursePayload('incomplete-draft'),
      description: '',
      estimatedDuration: '',
      category: '',
      modules: [
        {
          title: '',
          order: 0,
          blocks: [
            { type: 'paragraph', text: '' },
            { type: 'image', url: '', altText: '', layout: 'wide' },
          ],
        },
      ],
      assessment: {
        questions: [{ question: '', options: ['', ''], correctAnswer: 0, points: 1, order: 0 }],
      },
      status: 'published',
    };
    const created = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(incomplete);
    expect(created.status).toBe(201);
    expect(created.body.course.status).toBe('draft');
    const publish = await request(app)
      .post(`/api/v1/courses/${created.body.course.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(publish.status).toBe(422);
    expect(publish.body.error.code).toBe('COURSE_NOT_PUBLISHABLE');
  });

  it('does not let an edit leave a published course invalid', async () => {
    const adminToken = await createAdmin();
    const course = await createAndPublishCourse(adminToken, 'published-invariant');
    const invalidEdit = await request(app)
      .patch(`/api/v1/courses/${course.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ modules: [] });
    expect(invalidEdit.status).toBe(422);
    expect(invalidEdit.body.error.code).toBe('COURSE_NOT_PUBLISHABLE');
    const persisted = await request(app)
      .get(`/api/v1/courses/${course.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(persisted.body.course.status).toBe('published');
    expect(persisted.body.course.modules).toHaveLength(1);
  });

  it('strips answer material for learners and scores weighted answers on the backend', async () => {
    const learner = await register();
    const adminToken = await createAdmin();
    const course = await createAndPublishCourse(adminToken);
    const detail = await request(app)
      .get(`/api/v1/courses/${course.slug}`)
      .set('Authorization', `Bearer ${learner.token}`);
    expect(detail.status).toBe(200);
    const serialized = JSON.stringify(detail.body);
    expect(serialized).not.toContain('correctAnswer');
    expect(serialized).not.toContain('explanation');

    const questions = detail.body.course.assessment.questions;
    const attempt = await request(app)
      .post('/api/v1/attempts')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({
        courseId: course.id,
        answers: [
          { questionId: questions[0].id, selectedOptionIndex: 1 },
          { questionId: questions[1].id, selectedOptionIndex: 1 },
        ],
        score: 999,
        percentage: 100,
        passed: true,
        userId: new mongoose.Types.ObjectId().toString(),
      });
    expect(attempt.status).toBe(201);
    expect(attempt.body.attempt).toMatchObject({ score: 2, maximumScore: 3, percentage: 66.67, passed: true });
    expect(attempt.body.attempt.feedback[0]).toMatchObject({
      question: 'Select the second answer',
      correct: true,
      explanation: 'The second option is correct.',
      correctOptionIndex: 1,
    });
    expect(attempt.body.attempt.feedback[1]).toMatchObject({ correct: false });
    const ownedReload = await request(app)
      .get(`/api/v1/attempts/${attempt.body.attempt.id}`)
      .set('Authorization', `Bearer ${learner.token}`);
    expect(ownedReload.body.attempt.feedback[0]).toMatchObject({ correct: true, question: 'Select the second answer' });

    const progressAfterPass = await request(app)
      .get(`/api/v1/progress/${course.id}`)
      .set('Authorization', `Bearer ${learner.token}`);
    expect(progressAfterPass.body.progress).toMatchObject({ passed: true, status: 'in_progress', bestScore: 66.67 });

    const completed = await request(app)
      .put(`/api/v1/progress/${course.id}`)
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ currentModuleIndex: 0, completedModuleIds: [detail.body.course.modules[0].id] });
    expect(completed.body.progress).toMatchObject({ passed: true, status: 'completed', bestScore: 66.67 });
    const completedAt = completed.body.progress.completedAt;
    const adminProgress = await request(app)
      .get('/api/v1/admin/progress')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminProgress.body.progress[0]).toMatchObject({ percentage: 100, completionPercentage: 100, moduleCount: 1 });

    const lowerRetake = await request(app)
      .post('/api/v1/attempts')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({
        courseId: course.id,
        answers: questions.map((question: any) => ({ questionId: question.id, selectedOptionIndex: 0 })),
      });
    expect(lowerRetake.body.attempt.passed).toBe(false);
    const preserved = await request(app)
      .get(`/api/v1/progress/${course.id}`)
      .set('Authorization', `Bearer ${learner.token}`);
    expect(preserved.body.progress).toMatchObject({ passed: true, status: 'completed', bestScore: 66.67, completedAt });
  });

  it('prevents cross-user progress and attempt access', async () => {
    const first = await register('first@example.com');
    const second = await register('second@example.com');
    const adminToken = await createAdmin();
    const course = await createAndPublishCourse(adminToken, 'privacy-course');
    const detail = await request(app)
      .get(`/api/v1/courses/${course.id}`)
      .set('Authorization', `Bearer ${first.token}`);
    const moduleId = detail.body.course.modules[0].id;
    await request(app)
      .put(`/api/v1/progress/${course.id}`)
      .set('Authorization', `Bearer ${first.token}`)
      .send({ currentModuleIndex: 0, completedModuleIds: [moduleId], status: 'completed', userId: second.user.id });
    const crossProgress = await request(app)
      .get(`/api/v1/progress/users/${first.user.id}`)
      .set('Authorization', `Bearer ${second.token}`);
    expect(crossProgress.status).toBe(403);

    const questions = detail.body.course.assessment.questions;
    const submitted = await request(app)
      .post('/api/v1/attempts')
      .set('Authorization', `Bearer ${first.token}`)
      .send({
        courseId: course.id,
        answers: questions.map((question: any) => ({ questionId: question.id, selectedOptionIndex: 0 })),
      });
    const crossAttempt = await request(app)
      .get(`/api/v1/attempts/${submitted.body.attempt.id}`)
      .set('Authorization', `Bearer ${second.token}`);
    expect(crossAttempt.status).toBe(404);
  });

  it('reconciles stale learner progress when modules are deleted or reordered', async () => {
    const learner = await register('module-progress@example.com');
    const adminToken = await createAdmin();
    const payload = coursePayload('module-reconciliation');
    payload.modules.push({
      title: 'Module two',
      order: 1,
      blocks: [{ type: 'paragraph', text: 'Second retained module.' }],
    });
    const created = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    const publishedResponse = await request(app)
      .post(`/api/v1/courses/${created.body.course.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    const course = publishedResponse.body.course;
    const deletedModuleId = course.modules[0].id;
    const retainedModule = course.modules[1];

    await request(app)
      .put(`/api/v1/progress/${course.id}`)
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ currentModuleIndex: 1, completedModuleIds: [deletedModuleId] });
    const edited = await request(app)
      .patch(`/api/v1/courses/${course.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ modules: [{ ...retainedModule, order: 0 }] });
    expect(edited.status).toBe(200);

    const reconciled = await request(app)
      .get(`/api/v1/progress/${course.id}`)
      .set('Authorization', `Bearer ${learner.token}`);
    expect(reconciled.body.progress).toMatchObject({ currentModuleIndex: 0, completedModuleIds: [] });

    const staleSave = await request(app)
      .put(`/api/v1/progress/${course.id}`)
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ currentModuleIndex: 99, completedModuleIds: [deletedModuleId, retainedModule.id] });
    expect(staleSave.status).toBe(200);
    expect(staleSave.body.progress).toMatchObject({
      currentModuleIndex: 0,
      completedModuleIds: [retainedModule.id],
      status: 'in_progress',
    });
  });
});

describe('seeded learner content', () => {
  it('serves every original module and paragraph block through the learner course API', async () => {
    await createAdmin('content-seed-admin@example.com');
    const admin = await User.findOne({ normalizedEmail: 'content-seed-admin@example.com' });
    expect(admin).toBeTruthy();
    await seedCourses(admin!._id);
    const learner = await register('content-reader@example.com');

    const listResponse = await request(app)
      .get('/api/v1/courses?limit=100')
      .set('Authorization', `Bearer ${learner.token}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.courses.map((course: any) => course.code).sort()).toEqual(
      ['ACS-01', 'DCT-01', 'DCT-02', 'HSE-01'],
    );

    const courseResponses = await Promise.all(
      ['dc-telecom-basics', 'testing-certification', 'health-and-safety', 'access-control-infrastructure']
        .map((slug) => request(app).get(`/api/v1/courses/${slug}`).set('Authorization', `Bearer ${learner.token}`)),
    );
    expect(courseResponses.every((response) => response.status === 200)).toBe(true);
    const courses = courseResponses.map((response) => response.body.course);
    const response = courseResponses[0]!;
    expect(response.body.course).toMatchObject({ code: 'DCT-01', status: 'published' });
    expect(courses.reduce((total, course) => total + course.modules.length, 0)).toBe(24);
    expect(
      courses.flatMap((course) => course.modules).flatMap((module: any) => module.blocks)
        .filter((block: any) => block.type === 'paragraph'),
    ).toHaveLength(48);
    expect(
      courses.every((course) => course.modules.flatMap((module: any) => module.blocks)
        .some((block: any) => block.type === 'image' && block.placeholder === true)),
    ).toBe(true);
    expect(response.body.course.modules[0].blocks[0].text).toBe(
      'A data centre is divided into functional zones so cabling stays organised and faults stay isolated. Signals enter at the Main Entrance Facility (MEF) and reach the Meet-Me Room (MMR), where carriers and tenants interconnect.',
    );
    expect(courses.reduce((total, course) => total + course.assessment.questions.length, 0)).toBe(40);
    expect(courses.reduce(
      (total, course) => total + course.assessment.questions.reduce(
        (courseTotal: number, question: any) => courseTotal + question.options.length,
        0,
      ),
      0,
    )).toBe(160);
    expect(courses.every((course) => course.assessment.questions.every(
      (question: any) => question.correctAnswer === undefined,
    ))).toBe(true);
  });
});

describe('media safety', () => {
  it('rejects learner uploads and content with a forged image MIME type', async () => {
    const learner = await register();
    const learnerUpload = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${learner.token}`)
      .field('altText', 'Unsafe file')
      .attach('image', Buffer.from('not an image'), { filename: '../payload.jpg', contentType: 'image/jpeg' });
    expect(learnerUpload.status).toBe(403);

    const adminToken = await createAdmin();
    const forged = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('altText', 'Forged image')
      .attach('image', Buffer.from('not an image'), { filename: 'payload.jpg', contentType: 'image/jpeg' });
    expect(forged.status).toBe(422);
    expect(forged.body.error.code).toBe('INVALID_IMAGE_CONTENT');
    expect(await MediaAsset.countDocuments()).toBe(0);

    const oversized = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('altText', 'Oversized image')
      .attach(
        'image',
        Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2_000)]),
        { filename: 'large.png', contentType: 'image/png' },
      );
    expect(oversized.status).toBe(413);

    const doubleExtension = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('altText', 'Double extension')
      .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0x00]), { filename: 'payload.php.jpg', contentType: 'image/jpeg' });
    expect(doubleExtension.status).toBe(422);
  });

  it('accepts a signature-valid local image and deletes the asset safely', async () => {
    const adminToken = await createAdmin();
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(24),
    ]);
    const uploaded = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('altText', 'Generated test placeholder')
      .attach('image', png, { filename: 'placeholder.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.media.url).toMatch(/^\/uploads\/[a-f\d-]+\.png$/);
    expect(uploaded.body.media.url).not.toContain('..');
    const served = await request(app).get(uploaded.body.media.url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toContain('image/png');
    const referencingCourse = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...coursePayload('media-reference'), coverImage: uploaded.body.media.url });
    expect(referencingCourse.status).toBe(201);
    const blockedDelete = await request(app)
      .delete(`/api/v1/media/${uploaded.body.media.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(blockedDelete.status).toBe(409);
    expect(blockedDelete.body.error).toMatchObject({
      code: 'MEDIA_IN_USE',
      details: { usageCount: 1, courses: [{ code: referencingCourse.body.course.code }] },
    });
    const detach = await request(app)
      .patch(`/api/v1/courses/${referencingCourse.body.course.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coverImage: '' });
    expect(detach.status).toBe(200);
    const deleted = await request(app)
      .delete(`/api/v1/media/${uploaded.body.media.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(204);
    expect(await MediaAsset.countDocuments()).toBe(0);
  });
});
