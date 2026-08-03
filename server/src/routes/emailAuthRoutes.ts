import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getEnv } from '../config/env';
import { validate } from '../middleware/validate';
import { EmailVerificationToken } from '../models/EmailVerificationToken';
import { User } from '../models/User';
import { recordInstructorRegistration } from '../services/auditService';
import {
  resendVerificationEmail,
  sendVerificationEmail,
  verifyEmail,
} from '../services/emailVerificationService';
import { issueSession } from '../services/tokenService';
import { userDto } from '../services/userService';
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
const publicRole = z.enum(['learner', 'instructor']);
const instructorCode = z.string().regex(/^\d{6}$/, 'Instructor access code must contain exactly six digits');
const registrationSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email,
    password,
    role: publicRole.default('learner'),
    instructorCode: instructorCode.optional(),
  })
  .strict()
  .superRefine((body, context) => {
    if (body.role === 'instructor' && !body.instructorCode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['instructorCode'],
        message: 'Instructor access code is required',
      });
    }
  });
const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
const verifySchema = z.object({ token: z.string().trim().min(32).max(500) }).strict();
const resendSchema = z.object({ email }).strict();
const dummyHash = '$2b$12$c9O4xELvYHhA7rC8mFz/Jea.2YnM8m42FxTqZ4QdkQ6D7HB4sYmOm';

function rateLimitResponse(message: string) {
  return (request: any, response: any) => response.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message,
      requestId: request.requestId,
    },
  });
}

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: () => (getEnv().NODE_ENV === 'production' ? 20 : 500),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitResponse('Too many registration requests; try again later'),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: () => (getEnv().NODE_ENV === 'production' ? 10 : 500),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitResponse('Too many authentication requests; try again later'),
});

const verificationLimiter = rateLimit({
  windowMs: 30 * 60 * 1_000,
  limit: () => (getEnv().NODE_ENV === 'production' ? 12 : 500),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitResponse('Too many email verification requests; try again later'),
});

const verificationEmailLimiter = rateLimit({
  windowMs: 30 * 60 * 1_000,
  limit: () => (getEnv().NODE_ENV === 'production' ? 4 : 500),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (request) => {
    const normalized = typeof request.body?.email === 'string'
      ? normalizeEmail(request.body.email).slice(0, 254)
      : 'missing';
    return `email:${createHash('sha256').update(normalized).digest('hex')}`;
  },
  handler: rateLimitResponse('Too many verification emails requested; try again later'),
});

function assertInstructorRegistrationAllowed(code: string | undefined): void {
  const env = getEnv();
  if (!env.INSTRUCTOR_REGISTRATION_ENABLED) {
    throw new AppError(403, 'INSTRUCTOR_REGISTRATION_DISABLED', 'Instructor registration is disabled');
  }
  if (!env.INSTRUCTOR_REGISTRATION_CODE) {
    throw new AppError(503, 'INSTRUCTOR_REGISTRATION_UNAVAILABLE', 'Instructor registration is not configured');
  }
  const expected = Buffer.from(env.INSTRUCTOR_REGISTRATION_CODE, 'utf8');
  const supplied = Buffer.from(code ?? '', 'utf8');
  const matches = expected.length === supplied.length && timingSafeEqual(expected, supplied);
  if (!matches) throw new AppError(403, 'INVALID_INSTRUCTOR_CODE', 'Instructor access code is invalid');
}

router.get('/email-verification/status', (_request, response) => {
  const env = getEnv();
  response.json({
    data: {
      enabled: env.smtpEnabled || env.EMAIL_VERIFICATION_BYPASS,
      required: !env.EMAIL_VERIFICATION_BYPASS,
    },
  });
});

router.post(
  '/register',
  registrationLimiter,
  validate({ body: registrationSchema }),
  asyncHandler(async (request, response) => {
    const env = getEnv();
    const {
      name,
      email: normalizedEmail,
      password: rawPassword,
      role,
      instructorCode: suppliedInstructorCode,
    } = request.body;

    if (role === 'instructor') assertInstructorRegistrationAllowed(suppliedInstructorCode);
    if (!env.EMAIL_VERIFICATION_BYPASS && !env.smtpEnabled) {
      throw new AppError(503, 'EMAIL_VERIFICATION_UNAVAILABLE', 'Email verification is not configured');
    }
    if (await User.exists({ normalizedEmail })) {
      throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
    }

    const verificationRequired = !env.EMAIL_VERIFICATION_BYPASS;
    const user = await User.create({
      name,
      email: normalizedEmail,
      normalizedEmail,
      passwordHash: await bcrypt.hash(rawPassword, 12),
      role,
      status: verificationRequired ? 'pending_verification' : 'active',
      emailVerifiedAt: verificationRequired ? undefined : new Date(),
      lastLoginAt: verificationRequired ? undefined : new Date(),
    });

    try {
      if (user.role === 'instructor') {
        await recordInstructorRegistration(request, user._id, 'password');
      }
      if (verificationRequired) {
        await sendVerificationEmail(user, request.ip);
      }
    } catch (error) {
      await Promise.all([
        EmailVerificationToken.deleteMany({ userId: user._id }),
        User.deleteOne({ _id: user._id }),
      ]);
      if (error instanceof AppError) throw error;
      console.error('Registration email delivery failed', error);
      throw new AppError(503, 'EMAIL_DELIVERY_FAILED', 'Account email could not be sent. Try again later.');
    }

    if (verificationRequired) {
      response.status(201).json({
        data: {
          verificationRequired: true,
          email: user.email,
          message: 'Check your inbox and verify your email before signing in.',
        },
      });
      return;
    }

    const accessToken = await issueSession(user, request, response);
    const dto = userDto(user);
    response.status(201).json({ data: { accessToken, user: dto }, accessToken, user: dto });
  }),
);

router.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (request, response) => {
    const user = await User.findOne({ normalizedEmail: request.body.email }).select('+passwordHash');
    const passwordMatches = await bcrypt.compare(request.body.password, user?.passwordHash ?? dummyHash);
    if (!user || !passwordMatches) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    if (user.status === 'pending_verification') {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before signing in');
    }
    if (user.status !== 'active') {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account is disabled');
    }

    user.lastLoginAt = new Date();
    await user.save();
    const accessToken = await issueSession(user, request, response);
    const dto = userDto(user);
    response.json({ data: { accessToken, user: dto }, accessToken, user: dto });
  }),
);

router.post(
  '/verify-email',
  verificationLimiter,
  validate({ body: verifySchema }),
  asyncHandler(async (request, response) => {
    await verifyEmail(request.body.token);
    response.json({ data: { verified: true }, verified: true });
  }),
);

router.post(
  '/resend-verification',
  verificationLimiter,
  verificationEmailLimiter,
  validate({ body: resendSchema }),
  asyncHandler(async (request, response) => {
    const env = getEnv();
    if (env.EMAIL_VERIFICATION_BYPASS) {
      response.status(202).json({ data: { accepted: true } });
      return;
    }
    if (!env.smtpEnabled) {
      throw new AppError(503, 'EMAIL_VERIFICATION_UNAVAILABLE', 'Email verification is not configured');
    }
    await resendVerificationEmail(request.body.email, request.ip);
    response.status(202).json({
      data: {
        accepted: true,
        message: 'If an unverified account uses that email, a new verification link has been sent.',
      },
    });
  }),
);

export { router as emailAuthRoutes };
