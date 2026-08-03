import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { connectDatabase } from '../src/config/database';
import { EmailVerificationToken } from '../src/models/EmailVerificationToken';
import { User } from '../src/models/User';

let app: Express;

beforeAll(async () => {
  await connectDatabase();
  app = createApp();
});

describe('email verification', () => {
  it('activates a pending account once and allows login afterwards', async () => {
    const email = 'pending-verification@example.com';
    const password = 'PendingPass123!';
    const user = await User.create({
      name: 'Pending Learner',
      email,
      normalizedEmail: email,
      passwordHash: await bcrypt.hash(password, 4),
      role: 'learner',
      status: 'pending_verification',
    });

    const blockedLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(blockedLogin.status).toBe(403);
    expect(blockedLogin.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const rawToken = 'secure-email-verification-token-for-pending-account-123456789';
    await EmailVerificationToken.create({
      userId: user._id,
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() + 15 * 60 * 1_000),
    });

    const verification = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: rawToken });
    expect(verification.status).toBe(200);
    expect(verification.body.verified).toBe(true);

    const activated = await User.findById(user._id);
    expect(activated?.status).toBe('active');
    expect(activated?.emailVerifiedAt).toBeInstanceOf(Date);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(login.status).toBe(200);

    const reused = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: rawToken });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('EMAIL_VERIFICATION_INVALID');
  });
});
