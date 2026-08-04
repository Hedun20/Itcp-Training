import { createHash } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { normalizeEmail } from '../utils/email';

const router = Router();
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
    const candidate = request.body?.email;
    const normalized = typeof candidate === 'string'
      ? normalizeEmail(candidate).slice(0, 254)
      : 'missing';
    return `email:${createHash('sha256').update(normalized).digest('hex')}`;
  },
});

router.post('/register', instructorIpLimiter, instructorEmailLimiter, (_request, _response, next) => next());

export { router as instructorRegistrationProtectionRoutes };
