import bcrypt from 'bcryptjs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getEnv } from '../config/env';
import { configurePassport, passport } from '../config/passport';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { User } from '../models/User';
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
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: process.env.NODE_ENV === 'test' ? 1_000 : 30,
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

const email = z.string().trim().email().max(254).transform(normalizeEmail);
const password = z.string().min(10).max(128);
const registrationSchema = z.object({ name: z.string().trim().min(2).max(120), email, password });
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const dummyHash = '$2b$12$c9O4xELvYHhA7rC8mFz/Jea.2YnM8m42FxTqZ4QdkQ6D7HB4sYmOm';

router.use(authLimiter);

router.post(
  '/register',
  validate({ body: registrationSchema }),
  asyncHandler(async (request, response) => {
    const { name, email: normalizedEmail, password: rawPassword } = request.body;
    if (await User.exists({ normalizedEmail })) {
      throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
    }
    const user = await User.create({
      name,
      email: normalizedEmail,
      normalizedEmail,
      passwordHash: await bcrypt.hash(rawPassword, 12),
      role: 'learner',
      status: 'active',
      lastLoginAt: new Date(),
    });
    const accessToken = await issueSession(user, request, response);
    const dto = userDto(user);
    response.status(201).json({ data: { accessToken, user: dto }, accessToken, user: dto });
  }),
);

router.post(
  '/login',
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
  asyncHandler(async (request, response) => {
    const rawToken = request.cookies?.[getEnv().REFRESH_COOKIE_NAME] as string | undefined;
    await revokeRefreshToken(rawToken, request);
    clearRefreshCookie(response);
    response.status(204).send();
  }),
);

router.get('/me', authenticate, (request, response) => {
  const dto = userDto(request.user!);
  response.json({ data: dto, user: dto });
});

router.get('/google/status', (_request, response) => {
  response.json({ data: { enabled: getEnv().googleEnabled }, enabled: getEnv().googleEnabled });
});

const googleUnavailable: RequestHandler = (_request, _response, next) => {
  next(new AppError(503, 'GOOGLE_AUTH_UNAVAILABLE', 'Google sign-in is not configured'));
};

router.get('/google', (request, response, next) => {
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

router.get('/google/callback', (request, response, next) => {
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
  passport.authenticate('google', { session: false }, async (error: unknown, user: any) => {
    try {
      if (error || !user) throw new AppError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in failed');
      await issueSession(user, request, response);
      response.redirect(`${getEnv().allowedOrigins[0]}/auth/google/callback`);
    } catch (callbackError) {
      next(callbackError);
    }
  })(request, response, next);
});

export { router as authRoutes };
