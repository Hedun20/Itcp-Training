import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getEnv } from './config/env';
import { passport } from './config/passport';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { requestId } from './middleware/requestId';
import { adminRoutes } from './routes/adminRoutes';
import { attemptRoutes } from './routes/attemptRoutes';
import { authRoutes } from './routes/authRoutes';
import { courseRoutes } from './routes/courseRoutes';
import { healthRoutes } from './routes/healthRoutes';
import { instructorRoutes } from './routes/instructorRoutes';
import { mediaRoutes } from './routes/mediaRoutes';
import { passwordResetRoutes } from './routes/passwordResetRoutes';
import { progressRoutes } from './routes/progressRoutes';
import { userRoutes } from './routes/userRoutes';

export function createApp() {
  const env = getEnv();
  const app = express();
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(passport.initialize());

  fs.mkdirSync(env.uploadsDirectory, { recursive: true });
  app.use(
    '/uploads',
    express.static(path.resolve(env.uploadsDirectory), {
      dotfiles: 'deny',
      fallthrough: false,
      index: false,
      immutable: true,
      maxAge: '7d',
      setHeaders(response) {
        response.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );

  const api = express.Router();
  api.use('/health', healthRoutes);
  api.use('/auth', passwordResetRoutes);
  api.use('/auth', authRoutes);
  api.use('/users', userRoutes);
  api.use('/courses', courseRoutes);
  api.use('/progress', progressRoutes);
  api.use('/attempts', attemptRoutes);
  api.use('/media', mediaRoutes);
  api.use('/instructor', instructorRoutes);
  api.use('/admin', adminRoutes);
  app.use('/api/v1', api);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
