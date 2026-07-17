import { createHash } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getEnv } from '../config/env';
import { validate } from '../middleware/validate';
import { requestPasswordReset, resetPassword } from '../services/passwordResetService';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { normalizeEmail } from '../utils/email';

const router = Router();
const email = z.string().trim().email().max(254).transform(normalizeEmail);
const password = z
  .string()
  .min(10, 'Password must contain at least 10 characters')
  .max(128, 'Password must contain at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one digit');
const forgotSchema = z.object({ email }).strict();
const resetSchema = z.object({ token: z.string().trim().min(32).max(500), password }).strict();

function rateLimitResponse(request: any, response: any) {
  response.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many password recovery requests; try again later',
      requestId: request.requestId,
    },
  });
}

const forgotIpLimiter = rateLimit({
  windowMs: 30 * 60 * 1_000,
  limit: () => (getEnv().NODE_ENV === 'production' ? 8 : 500),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitResponse,
});

const forgotEmailLimiter = rateLimit({
  windowMs: 30 * 60 * 1_000,
  limit: () => (getEnv().NODE_ENV === 'production' ? 4 : 500),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (request) => {
    const normalized = typeof request.body?.email === 'string' ? normalizeEmail(request.body.email).slice(0, 254) : 'missing';
    return `email:${createHash('sha256').update(normalized).digest('hex')}`;
  },
  handler: rateLimitResponse,
});

const resetLimiter = rateLimit({
  windowMs: 30 * 60 * 1_000,
  limit: () => (getEnv().NODE_ENV === 'production' ? 12 : 500),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitResponse,
});

router.get('/password-reset/status', (_request, response) => {
  response.json({
    data: { enabled: getEnv().passwordResetEmailEnabled },
    enabled: getEnv().passwordResetEmailEnabled,
  });
});

router.post(
  '/forgot-password',
  forgotIpLimiter,
  forgotEmailLimiter,
  validate({ body: forgotSchema }),
  asyncHandler(async (request, response) => {
    if (!getEnv().passwordResetEmailEnabled) {
      throw new AppError(503, 'PASSWORD_RESET_UNAVAILABLE', 'Password reset email is not configured');
    }
    await requestPasswordReset(request.body.email, request.ip);
    response.status(202).json({
      data: {
        accepted: true,
        message: 'If an active account uses that email, a password reset link has been sent.',
      },
    });
  }),
);

router.post(
  '/reset-password',
  resetLimiter,
  validate({ body: resetSchema }),
  asyncHandler(async (request, response) => {
    await resetPassword(request.body.token, request.body.password, request.ip);
    response.json({ data: { reset: true }, reset: true });
  }),
);

export { router as passwordResetRoutes };
