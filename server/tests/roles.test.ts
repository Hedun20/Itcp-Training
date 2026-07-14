import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { connectDatabase } from '../src/config/database';
import { resetEnvForTests } from '../src/config/env';
import { AssessmentAttempt } from '../src/models/AssessmentAttempt';
import { AuditLog } from '../src/models/AuditLog';
import { CourseProgress } from '../src/models/CourseProgress';
import { User } from '../src/models/User';
import {
  createGoogleRegistrationToken,
  GOOGLE_REGISTRATION_COOKIE,
} from '../src/routes/authRoutes';

let app: Express;
const instructorCode = '482731';

beforeAll(async () => {
  await connectDatabase();
  app = createApp();
});

function registration(
  email: string,
  role: 'learner' | 'instructor',
  options: { code?: string; ip?: string } = {},
) {
  return request(app)
    .post('/api/v1/auth/register')
    .set('X-Forwarded-For', options.ip ?? '203.0.113.10')
    .send({
      name: role === 'instructor' ? 'Test Instructor' : 'Test Learner',
      email,
      password: 'SecurePass123!',
      role,
      ...(options.code === undefined ? {} : { instructorCode: options.code }),
    });
}

function coursePayload(code: string, slug: string) {
  return {
    code,
    slug,
    title: `Course ${code}`,
    shortDescription: 'A sufficiently long course summary for authorization tests.',
    description: 'A sufficiently long course description for authorization tests.',
    estimatedDuration: '1 hr',
    passMark: 60,
    category: 'Testing',
    tags: ['testing'],
    modules: [{ title: 'Module one', order: 0, blocks: [{ type: 'paragraph', text: 'Course content.' }] }],
    assessment: {
      questions: [{ questionText: 'Choose the answer', options: ['Correct', 'Wrong'], correctAnswer: 0, points: 1, order: 0 }],
    },
  };
}

function googleCookie(identity: { googleId: string; email: string; name: string }) {
  const token = createGoogleRegistrationToken({
    ...identity,
    normalizedEmail: identity.email.toLowerCase(),
  });
  return `${GOOGLE_REGISTRATION_COOKIE}=${token}`;
}

describe('public role registration', () => {
  it('registers a learner without an instructor code', async () => {
    const response = await registration('learner-role@example.com', 'learner');
    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ email: 'learner-role@example.com', role: 'learner' });
  });

  it('registers an instructor with the server-side code and audits without storing the code', async () => {
    const response = await registration('instructor-valid@example.com', 'instructor', {
      code: instructorCode,
      ip: '203.0.113.12',
    });
    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ role: 'instructor' });
    const audit = await AuditLog.findOne({ action: 'instructor.registered' }).lean();
    expect(audit).toMatchObject({ targetType: 'user', metadata: { method: 'password' } });
    expect(JSON.stringify(audit)).not.toContain(instructorCode);
    expect(JSON.stringify(audit)).not.toContain('instructorCode');
  });

  it('rejects an invalid instructor code', async () => {
    const response = await registration('instructor-invalid@example.com', 'instructor', {
      code: '000000',
      ip: '203.0.113.13',
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('INVALID_INSTRUCTOR_CODE');
    expect(await User.exists({ normalizedEmail: 'instructor-invalid@example.com' })).toBeNull();
  });

  it('rejects instructor registration while the feature is disabled', async () => {
    process.env.INSTRUCTOR_REGISTRATION_ENABLED = 'false';
    resetEnvForTests();
    try {
      const response = await registration('instructor-disabled@example.com', 'instructor', {
        code: instructorCode,
        ip: '203.0.113.14',
      });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INSTRUCTOR_REGISTRATION_DISABLED');
    } finally {
      process.env.INSTRUCTOR_REGISTRATION_ENABLED = 'true';
      resetEnvForTests();
    }
  });

  it('rejects public admin registration instead of silently downgrading it', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Public Admin',
      email: 'public-admin@example.com',
      password: 'SecurePass123!',
      role: 'admin',
    });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await User.exists({ normalizedEmail: 'public-admin@example.com' })).toBeNull();
  });
});

describe('Google first-time role selection', () => {
  it('creates a first-time Google learner only after explicit role selection', async () => {
    const response = await request(app)
      .post('/api/v1/auth/google/complete-registration')
      .set('Cookie', googleCookie({ googleId: 'google-new-learner', email: 'google-learner@example.com', name: 'Google Learner' }))
      .set('X-Forwarded-For', '203.0.113.20')
      .send({ role: 'learner' });
    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ email: 'google-learner@example.com', role: 'learner' });
    expect(await User.exists({ googleId: 'google-new-learner', role: 'learner' })).toBeTruthy();
  });

  it('requires the code for a first-time Google instructor and records a code-free audit', async () => {
    const response = await request(app)
      .post('/api/v1/auth/google/complete-registration')
      .set('Cookie', googleCookie({ googleId: 'google-new-instructor', email: 'google-instructor@example.com', name: 'Google Instructor' }))
      .set('X-Forwarded-For', '203.0.113.21')
      .send({ role: 'instructor', instructorCode });
    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('instructor');
    const audit = await AuditLog.findOne({ action: 'instructor.registered' }).lean();
    expect(audit?.metadata).toEqual({ method: 'google' });
    expect(JSON.stringify(audit)).not.toContain(instructorCode);
  });

  it('does not change an existing Google-linked user role during onboarding completion', async () => {
    const existing = await User.create({
      name: 'Existing Google User',
      email: 'existing-google@example.com',
      normalizedEmail: 'existing-google@example.com',
      googleId: 'existing-google-id',
      role: 'learner',
      status: 'active',
    });
    const response = await request(app)
      .post('/api/v1/auth/google/complete-registration')
      .set('Cookie', googleCookie({ googleId: 'existing-google-id', email: 'existing-google@example.com', name: 'Changed Name' }))
      .set('X-Forwarded-For', '203.0.113.22')
      .send({ role: 'instructor', instructorCode });
    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('learner');
    expect((await User.findById(existing._id))?.role).toBe('learner');
    expect(await AuditLog.countDocuments({ action: 'instructor.registered' })).toBe(0);
  });
});

describe('instructor authorization and ownership', () => {
  it('lets instructors manage only their own courses and blocks every admin endpoint', async () => {
    const first = await registration('owner-one@example.com', 'instructor', {
      code: instructorCode,
      ip: '203.0.113.30',
    });
    const second = await registration('owner-two@example.com', 'instructor', {
      code: instructorCode,
      ip: '203.0.113.31',
    });
    const firstToken = first.body.accessToken as string;
    const secondToken = second.body.accessToken as string;
    const firstCourse = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${firstToken}`)
      .send(coursePayload('OWN-01', 'owner-one-course'));
    expect(firstCourse.status).toBe(201);
    expect(firstCourse.body.course.createdBy).toBe(first.body.user.id);

    const forbiddenEdit = await request(app)
      .patch(`/api/v1/courses/${firstCourse.body.course.id}`)
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ title: 'Unauthorized title' });
    expect(forbiddenEdit.status).toBe(403);
    expect(forbiddenEdit.body.error.code).toBe('COURSE_OWNERSHIP_REQUIRED');

    for (const action of ['publish', 'archive']) {
      const forbidden = await request(app)
        .post(`/api/v1/courses/${firstCourse.body.course.id}/${action}`)
        .set('Authorization', `Bearer ${firstToken}`);
      expect(forbidden.status).toBe(403);
    }
    const forbiddenRoleChange = await request(app)
      .patch(`/api/v1/users/${second.body.user.id}`)
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ role: 'admin' });
    expect(forbiddenRoleChange.status).toBe(403);

    for (const endpoint of ['/api/v1/admin/users', '/api/v1/admin/audit-logs', '/api/v1/admin/dashboard']) {
      const forbidden = await request(app).get(endpoint).set('Authorization', `Bearer ${firstToken}`);
      expect(forbidden.status).toBe(403);
    }
    for (const learnerEndpoint of ['/api/v1/progress', '/api/v1/attempts']) {
      const forbidden = await request(app).get(learnerEndpoint).set('Authorization', `Bearer ${firstToken}`);
      expect(forbidden.status).toBe(403);
    }
  });

  it('limits instructor media lists and deletion to assets they uploaded', async () => {
    const first = await registration('media-one@example.com', 'instructor', {
      code: instructorCode,
      ip: '203.0.113.32',
    });
    const second = await registration('media-two@example.com', 'instructor', {
      code: instructorCode,
      ip: '203.0.113.33',
    });
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(24),
    ]);
    const uploaded = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .field('altText', 'Instructor-owned placeholder')
      .attach('image', png, { filename: 'placeholder.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);

    const secondList = await request(app)
      .get('/api/v1/media')
      .set('Authorization', `Bearer ${second.body.accessToken}`);
    expect(secondList.body.media).toHaveLength(0);
    const forbiddenDelete = await request(app)
      .delete(`/api/v1/media/${uploaded.body.media.id}`)
      .set('Authorization', `Bearer ${second.body.accessToken}`);
    expect(forbiddenDelete.status).toBe(403);
    expect(forbiddenDelete.body.error.code).toBe('MEDIA_OWNERSHIP_REQUIRED');
    const forbiddenReference = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .send({ ...coursePayload('IMG-02', 'cross-owner-image'), coverImage: uploaded.body.media.url });
    expect(forbiddenReference.status).toBe(403);
    expect(forbiddenReference.body.error.code).toBe('MEDIA_OWNERSHIP_REQUIRED');
    const deleted = await request(app)
      .delete(`/api/v1/media/${uploaded.body.media.id}`)
      .set('Authorization', `Bearer ${first.body.accessToken}`);
    expect(deleted.status).toBe(204);
  });

  it('returns progress and results only for courses owned by the instructor', async () => {
    const first = await registration('report-one@example.com', 'instructor', {
      code: instructorCode,
      ip: '203.0.113.34',
    });
    const second = await registration('report-two@example.com', 'instructor', {
      code: instructorCode,
      ip: '203.0.113.35',
    });
    const learner = await registration('report-learner@example.com', 'learner', { ip: '203.0.113.36' });
    const firstCourse = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .send(coursePayload('RPT-01', 'report-course-one'));
    const secondCourse = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .send(coursePayload('RPT-02', 'report-course-two'));
    const learnerId = learner.body.user.id;
    const firstCourseId = firstCourse.body.course.id;
    const secondCourseId = secondCourse.body.course.id;
    const firstQuestionId = firstCourse.body.course.assessment.questions[0].id;
    const secondQuestionId = secondCourse.body.course.assessment.questions[0].id;
    await CourseProgress.create([
      { userId: learnerId, courseId: firstCourseId, status: 'in_progress', currentModuleIndex: 0, completedModuleIds: [], passed: false },
      { userId: learnerId, courseId: secondCourseId, status: 'in_progress', currentModuleIndex: 0, completedModuleIds: [], passed: false },
    ]);
    const attemptBase = {
      userId: learnerId,
      score: 1,
      maximumScore: 1,
      percentage: 100,
      passed: true,
      startedAt: new Date(),
      submittedAt: new Date(),
    };
    await AssessmentAttempt.create([
      { ...attemptBase, courseId: firstCourseId, answers: [{ questionId: firstQuestionId, questionText: 'Q1', selectedOptionIndex: 0, correctOptionIndex: 0, pointsAwarded: 1 }] },
      { ...attemptBase, courseId: secondCourseId, answers: [{ questionId: secondQuestionId, questionText: 'Q2', selectedOptionIndex: 0, correctOptionIndex: 0, pointsAwarded: 1 }] },
    ]);

    const progress = await request(app)
      .get('/api/v1/instructor/progress')
      .set('Authorization', `Bearer ${first.body.accessToken}`);
    expect(progress.status).toBe(200);
    expect(progress.body.progress).toHaveLength(1);
    expect(progress.body.progress[0].courseId).toBe(firstCourseId);
    const results = await request(app)
      .get('/api/v1/instructor/results')
      .set('Authorization', `Bearer ${first.body.accessToken}`);
    expect(results.status).toBe(200);
    expect(results.body.results).toHaveLength(1);
    expect(results.body.results[0].courseId).toBe(firstCourseId);
  });
});

describe('authentication rate limiting boundaries', () => {
  it('does not count /auth/me or /auth/google/status as login attempts', async () => {
    const registered = await registration('limiter-login@example.com', 'learner', { ip: '203.0.113.40' });
    process.env.NODE_ENV = 'production';
    resetEnvForTests();
    try {
      for (let index = 0; index < 12; index += 1) {
        const status = await request(app)
          .get('/api/v1/auth/google/status')
          .set('X-Forwarded-For', '203.0.113.40');
        const me = await request(app)
          .get('/api/v1/auth/me')
          .set('X-Forwarded-For', '203.0.113.40')
          .set('Authorization', `Bearer ${registered.body.accessToken}`);
        expect(status.status).toBe(200);
        expect(me.status).toBe(200);
        expect(status.headers['ratelimit-policy']).toBeTruthy();
        expect(me.headers['ratelimit-policy']).toBeTruthy();
      }
      const login = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '203.0.113.40')
        .send({ email: 'limiter-login@example.com', password: 'SecurePass123!' });
      expect(login.status).toBe(200);
      expect(login.headers['ratelimit-policy']).toBeTruthy();
      expect(login.headers['ratelimit-policy']).not.toBe(
        (await request(app).get('/api/v1/auth/google/status').set('X-Forwarded-For', '203.0.113.40')).headers['ratelimit-policy'],
      );
    } finally {
      process.env.NODE_ENV = 'test';
      resetEnvForTests();
    }
  });

  it('rate limits instructor-code failures by IP even when emails change', async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await registration(`rate-ip-${index}@example.com`, 'instructor', {
        code: '000000',
        ip: '203.0.113.250',
      });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5)).toEqual([403, 403, 403, 403, 403]);
    expect(statuses[5]).toBe(429);
  });

  it('counts malformed instructor codes in the strict IP attempt window', async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await registration(`rate-malformed-${index}@example.com`, 'instructor', {
        code: index % 2 === 0 ? '12345' : 'not-digits',
        ip: '203.0.113.251',
      });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5)).toEqual([422, 422, 422, 422, 422]);
    expect(statuses[5]).toBe(429);
  });

  it('rate limits instructor-code failures by normalized email across IPs', async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await registration('Rate-Email@Example.COM', 'instructor', {
        code: '000000',
        ip: `198.51.100.${index + 1}`,
      });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5)).toEqual([403, 403, 403, 403, 403]);
    expect(statuses[5]).toBe(429);
  });
});
