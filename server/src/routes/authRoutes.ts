import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getEnv } from '../config/env';
import {
  configurePassport,
  passport,
  type GoogleAuthentication,
  type PendingGoogleIdentity,
} from '../config/passport';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { User } from '../models/User';
import { recordInstructorRegistration } from '../services/auditService';
import {
  clearRefreshCookie,
  issueSession,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../services/tokenService';
import { userDto } from '../services/userService';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { normalizeEmail } from '../utils/email';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: () => {
    const environment = getEnv().NODE_ENV;
    if (environment === 'test') return 1_000;
    if (environment === 'development') return 200;
    return 10;
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(request, response) {
    response.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication requests; try again later',
        requestId: request.requestId,
      },
    });
  },
});

const publicRegistrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: () => (getEnv().NODE_ENV === 'production' ? 20 : 500),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(request, response) {
    response.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many registration requests; try again later',
        requestId: request.requestId,
      },
    });
  },
});

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: () => (getEnv().NODE_ENV === 'production' ? 120 : 2_000),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(request, response) {
    response.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many session requests; try again later',
        requestId: request.requestId,
      },
    });
  },
});

const authReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: () => (getEnv().NODE_ENV === 'production' ? 600 : 5_000),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(request, response) {
    response.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication status requests; try again later',
        requestId: request.requestId,
      },
    });
  },
});

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: () => (getEnv().NODE_ENV === 'production' ? 30 : 500),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(request, response) {
    response.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many Google authentication requests; try again later',
        requestId: request.requestId,
      },
    });
  },
});

const instructorWindowMs =
  (Number.parseInt(process.env.INSTRUCTOR_CODE_WINDOW_MINUTES ?? '30', 10) || 30) * 60 * 1_000;
const instructorMaxAttempts = Number.parseInt(process.env.INSTRUCTOR_CODE_MAX_ATTEMPTS ?? '5', 10) || 5;
const instructorRateLimitOptions = {
  windowMs: instructorWindowMs,
  limit: instructorMaxAttempts,
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (request: any) => request.body?.role !== 'instructor',
  handler(request: any, response: any) {
    response.status(429).json({
      error: {
        code: 'INSTRUCTOR_CODE_RATE_LIMITED',
        message: 'Too many instructor registration attempts; try again later',
        requestId: request.requestId,
      },
    });
  },
};
const instructorIpLimiter = rateLimit(instructorRateLimitOptions);
const instructorEmailLimiter = rateLimit({
  ...instructorRateLimitOptions,
  keyGenerator: (request) => {
    const candidate = request.googleRegistration?.normalizedEmail ?? request.body?.email;
    const normalized = typeof candidate === 'string'
      ? normalizeEmail(candidate).slice(0, 254)
      : 'missing';
    return `email:${createHash('sha256').update(normalized).digest('hex')}`;
  },
});

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
const googleRegistrationSchema = z
  .object({ role: publicRole, instructorCode: instructorCode.optional() })
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
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const dummyHash = '$2b$12$c9O4xELvYHhA7rC8mFz/Jea.2YnM8m42FxTqZ4QdkQ6D7HB4sYmOm';
export const GOOGLE_REGISTRATION_COOKIE = 'itcp_google_registration';
const googleRegistrationPayload = z.object({
  type: z.literal('google-registration'),
  googleId: z.string().min(1).max(500),
  email: z.string().email().max(254),
  normalizedEmail: z.string().email().max(254),
  name: z.string().min(1).max(120),
  avatarUrl: z.string().url().max(2_000).optional(),
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

function googleRegistrationCookieOptions(maxAge?: number) {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/v1/auth/google/complete-registration',
    ...(maxAge ? { maxAge } : {}),
  };
}

export function createGoogleRegistrationToken(identity: PendingGoogleIdentity): string {
  return jwt.sign(
    { ...identity, type: 'google-registration' },
    getEnv().JWT_ACCESS_SECRET,
    { expiresIn: '10m' },
  );
}

function verifyGoogleRegistration(rawToken: string): PendingGoogleIdentity {
  try {
    const payload = googleRegistrationPayload.parse(
      jwt.verify(rawToken, getEnv().JWT_ACCESS_SECRET) as JwtPayload,
    );
    return {
      googleId: payload.googleId,
      email: payload.email,
      normalizedEmail: payload.normalizedEmail,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
    };
  } catch {
    throw new AppError(401, 'GOOGLE_REGISTRATION_EXPIRED', 'Google registration is invalid or expired');
  }
}

const loadGoogleRegistration: RequestHandler = (request, _response, next) => {
  const rawToken = request.cookies?.[GOOGLE_REGISTRATION_COOKIE] as string | undefined;
  if (!rawToken) return next(new AppError(401, 'GOOGLE_REGISTRATION_REQUIRED', 'Complete Google authentication first'));
  try {
    request.googleRegistration = verifyGoogleRegistration(rawToken);
    next();
  } catch (error) {
    next(error);
  }
};

router.post(
  '/register',
  publicRegistrationLimiter,
  instructorIpLimiter,
  instructorEmailLimiter,
  validate({ body: registrationSchema }),
  asyncHandler(async (request, response) => {
    const {
      name,
      email: normalizedEmail,
      password: rawPassword,
      role,
      instructorCode: suppliedInstructorCode,
    } = request.body;
    if (role === 'instructor') assertInstructorRegistrationAllowed(suppliedInstructorCode);
    if (await User.exists({ normalizedEmail })) {
      throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
    }
    const user = await User.create({
      name,
      email: normalizedEmail,
      normalizedEmail,
      passwordHash: await bcrypt.hash(rawPassword, 12),
      role,
      status: 'active',
      lastLoginAt: new Date(),
    });
    if (user.role === 'instructor') {
      try {
        await recordInstructorRegistration(request, user._id, 'password');
      } catch (error) {
        await User.deleteOne({ _id: user._id });
        throw error;
      }
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
    if (!user || !passwordMatches) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    if (user.status !== 'active') throw new AppError(403, 'ACCOUNT_DISABLED', 'This account is disabled');
    user.lastLoginAt = new Date();
    await user.save();
    const accessToken = await issueSession(user, request, response);
    const dto = userDto(user);
    response.json({ data: { accessToken, user: dto }, accessToken, user: dto });
  }),
);

router.post(
  '/refresh',
  sessionLimiter,
  asyncHandler(async (request, response) => {
    const rawToken = request.cookies?.[getEnv().REFRESH_COOKIE_NAME] as string | undefined;
    if (!rawToken) throw new AppError(401, 'REFRESH_TOKEN_REQUIRED', 'Refresh cookie is required');
    const session = await rotateRefreshToken(rawToken, request, response);
    const dto = userDto(session.user);
    response.json({ data: { accessToken: session.accessToken, user: dto }, accessToken: session.accessToken, user: dto });
  }),
);

router.post(
  '/logout',
  sessionLimiter,
  asyncHandler(async (request, response) => {
    const rawToken = request.cookies?.[getEnv().REFRESH_COOKIE_NAME] as string | undefined;
    await revokeRefreshToken(rawToken, request);
    clearRefreshCookie(response);
    response.status(204).send();
  }),
);

router.get('/me', authReadLimiter, authenticate, (request, response) => {
  const dto = userDto(request.user!);
  response.json({ data: dto, user: dto });
});

router.get('/google/status', authReadLimiter, (_request, response) => {
  response.json({ data: { enabled: getEnv().googleEnabled }, enabled: getEnv().googleEnabled });
});

router.post(
  '/google/complete-registration',
  publicRegistrationLimiter,
  loadGoogleRegistration,
  instructorIpLimiter,
  instructorEmailLimiter,
  validate({ body: googleRegistrationSchema }),
  asyncHandler(async (request, response) => {
    const identity = request.googleRegistration!;
    const [googleUser, emailUser] = await Promise.all([
      User.findOne({ googleId: identity.googleId }),
      User.findOne({ normalizedEmail: identity.normalizedEmail }),
    ]);
    if (googleUser && emailUser && !googleUser._id.equals(emailUser._id)) {
      throw new AppError(409, 'GOOGLE_IDENTITY_CONFLICT', 'Google identity conflicts with an existing account');
    }
    let user = googleUser ?? emailUser;

    if (user) {
      if (user.status !== 'active') throw new AppError(403, 'ACCOUNT_DISABLED', 'This account is disabled');
      user.googleId = identity.googleId;
      user.avatarUrl = identity.avatarUrl ?? user.avatarUrl;
      user.lastLoginAt = new Date();
      await user.save();
    } else {
      if (request.body.role === 'instructor') {
        assertInstructorRegistrationAllowed(request.body.instructorCode);
      }
      user = await User.create({
        name: identity.name,
        email: identity.email,
        normalizedEmail: identity.normalizedEmail,
        googleId: identity.googleId,
        avatarUrl: identity.avatarUrl,
        role: request.body.role,
        status: 'active',
        lastLoginAt: new Date(),
      });
      if (user.role === 'instructor') {
        try {
          await recordInstructorRegistration(request, user._id, 'google');
        } catch (error) {
          await User.deleteOne({ _id: user._id });
          throw error;
        }
      }
    }

    const accessToken = await issueSession(user, request, response);
    response.clearCookie(GOOGLE_REGISTRATION_COOKIE, googleRegistrationCookieOptions());
    const dto = userDto(user);
    response.status(201).json({ data: { accessToken, user: dto }, accessToken, user: dto });
  }),
);

const googleUnavailable: RequestHandler = (_request, _response, next) => {
  next(new AppError(503, 'GOOGLE_AUTH_UNAVAILABLE', 'Google sign-in is not configured'));
};

router.get('/google', oauthLimiter, (request, response, next) => {
  if (!configurePassport()) return googleUnavailable(request, response, next);
  const state = randomBytes(32).toString('base64url');
  response.cookie('itcp_oauth_state', state, {
    httpOnly: true,
    secure: getEnv().COOKIE_SECURE ?? getEnv().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth/google/callback',
    maxAge: 10 * 60 * 1_000,
  });
  return passport.authenticate('google', { scope: ['profile', 'email'], session: false, state })(request, response, next);
});

router.get('/google/callback', oauthLimiter, (request, response, next) => {
  if (!configurePassport()) return googleUnavailable(request, response, next);
  const expectedState = request.cookies?.itcp_oauth_state as string | undefined;
  const suppliedState = typeof request.query.state === 'string' ? request.query.state : undefined;
  response.clearCookie('itcp_oauth_state', {
    httpOnly: true,
    secure: getEnv().COOKIE_SECURE ?? getEnv().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth/google/callback',
  });
  if (
    !expectedState ||
    !suppliedState ||
    expectedState.length !== suppliedState.length ||
    !timingSafeEqual(Buffer.from(expectedState), Buffer.from(suppliedState))
  ) {
    return next(new AppError(401, 'INVALID_OAUTH_STATE', 'Google sign-in state is invalid or expired'));
  }
  passport.authenticate('google', { session: false }, async (error: unknown, result: any) => {
    try {
      if (error || !result) throw new AppError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in failed');
      const authentication = result as GoogleAuthentication;
      if (authentication.kind === 'existing') {
        await issueSession(authentication.user, request, response);
        response.redirect(`${getEnv().allowedOrigins[0]}/auth/google/callback`);
        return;
      }
      response.cookie(
        GOOGLE_REGISTRATION_COOKIE,
        createGoogleRegistrationToken(authentication.identity),
        googleRegistrationCookieOptions(10 * 60 * 1_000),
      );
      response.redirect(`${getEnv().allowedOrigins[0]}/auth/google/callback?onboarding=required`);
    } catch (callbackError) {
      next(callbackError);
    }
  })(request, response, next);
});

export { router as authRoutes };
