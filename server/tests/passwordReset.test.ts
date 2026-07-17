import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { connectDatabase } from '../src/config/database';
import { PasswordResetToken } from '../src/models/PasswordResetToken';
import { RefreshToken } from '../src/models/RefreshToken';
import { User } from '../src/models/User';

let app: Express;

beforeAll(async () => {
  await connectDatabase();
  app = createApp();
});

describe('password recovery', () => {
  it('reports unavailable delivery when Gmail API credentials are absent', async () => {
    const status = await request(app).get('/api/v1/auth/password-reset/status');
    expect(status.status).toBe(200);
    expect(status.body.enabled).toBe(false);

    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'admin@example.com' });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('PASSWORD_RESET_UNAVAILABLE');
  });

  it('resets an administrator password once and revokes existing sessions', async () => {
    const email = 'boss-admin@example.com';
    const user = await User.create({
      name: 'Boss Administrator',
      email,
      normalizedEmail: email,
      passwordHash: await bcrypt.hash('OldAdminPass123!', 4),
      role: 'admin',
      status: 'active',
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'OldAdminPass123!' });
    expect(login.status).toBe(200);
    expect(await RefreshToken.countDocuments({ userId: user._id, revokedAt: { $exists: false } })).toBe(1);

    const rawToken = 'secure-password-reset-token-for-admin-account-123456789';
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() + 15 * 60 * 1_000),
    });

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: 'NewAdminPass456!' });
    expect(reset.status).toBe(200);
    expect(reset.body.reset).toBe(true);
    expect(await RefreshToken.countDocuments({ userId: user._id, revokedAt: { $exists: false } })).toBe(0);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'OldAdminPass123!' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'NewAdminPass456!' });
    expect(newLogin.status).toBe(200);

    const reused = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: 'AnotherAdminPass789!' });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('PASSWORD_RESET_INVALID');
  });
});
