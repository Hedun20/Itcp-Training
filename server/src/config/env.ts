import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const serverRoot = path.resolve(__dirname, '../..');
// npm workspace scripts run with the package as cwd; load the repository-level env deliberately.
dotenv.config({ path: path.resolve(serverRoot, '../.env'), quiet: true });

function parseBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}

const optionalBooleanFromString = z.preprocess(parseBoolean, z.boolean().optional());
const booleanFromString = z.preprocess(parseBoolean, z.boolean().default(false));

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().url().optional(),
);
const optionalEmail = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().email().optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    CLIENT_URL: z.string().min(1).default('http://localhost:5173'),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/, 'Use a duration such as 15m, 1h, or 1d').default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    REFRESH_COOKIE_NAME: z.string().min(1).default('itcp_refresh'),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SECURE: optionalBooleanFromString,
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
    UPLOAD_MAX_BYTES: z.coerce.number().int().min(1_024).max(25 * 1024 * 1024).default(5 * 1024 * 1024),
    UPLOADS_DIRECTORY: z.string().min(1).default('uploads'),
    SEED_UPDATE_EXISTING: booleanFromString,
    INSTRUCTOR_REGISTRATION_ENABLED: booleanFromString,
    INSTRUCTOR_REGISTRATION_CODE: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().regex(/^\d{6}$/, 'INSTRUCTOR_REGISTRATION_CODE must contain exactly six digits').optional(),
    ),
    INSTRUCTOR_CODE_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(5),
    INSTRUCTOR_CODE_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1_440).default(30),
    GOOGLE_CLIENT_ID: optionalNonEmptyString,
    GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
    GOOGLE_CALLBACK_URL: optionalUrl,
    GOOGLE_GMAIL_REFRESH_TOKEN: optionalNonEmptyString,
    GOOGLE_GMAIL_SENDER: optionalEmail,
    GOOGLE_GMAIL_SENDER_NAME: z.string().trim().min(1).max(120).default('ITCP Training'),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(180).default(30),
    ADMIN_NAME: z.string().min(2).optional(),
    ADMIN_EMAIL: z.string().email().optional(),
    // Seed-only credential. Strength is enforced by seedAdmin so stale seed values
    // never prevent the long-running API or non-credential content repair from starting.
    ADMIN_PASSWORD: z.string().optional(),
  })
  .superRefine((env, context) => {
    const credentialsSupplied = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET].filter(Boolean).length;
    if (credentialsSupplied > 0 && !(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_CLIENT_ID'],
        message: 'Google OAuth requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL together',
      });
    }
    const gmailSupplied = [env.GOOGLE_GMAIL_REFRESH_TOKEN, env.GOOGLE_GMAIL_SENDER].filter(Boolean).length;
    if (gmailSupplied > 0 && !(env.GOOGLE_GMAIL_REFRESH_TOKEN && env.GOOGLE_GMAIL_SENDER)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_GMAIL_REFRESH_TOKEN'],
        message: 'Gmail password recovery requires GOOGLE_GMAIL_REFRESH_TOKEN and GOOGLE_GMAIL_SENDER together',
      });
    }
    if (gmailSupplied > 0 && !(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_GMAIL_REFRESH_TOKEN'],
        message: 'Gmail password recovery also requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
      });
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT refresh and access secrets must be different',
      });
    }
    if (env.NODE_ENV === 'production' && env.COOKIE_SECURE === false) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE cannot be false in production',
      });
    }
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (/replace[-_ ]?with/i.test(env[key])) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} still contains a placeholder; generate a random secret`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema> & {
  allowedOrigins: string[];
  uploadsDirectory: string;
  googleEnabled: boolean;
  passwordResetEmailEnabled: boolean;
};

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  cachedEnv = {
    ...parsed.data,
    allowedOrigins: parsed.data.CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean),
    uploadsDirectory: path.isAbsolute(parsed.data.UPLOADS_DIRECTORY)
      ? parsed.data.UPLOADS_DIRECTORY
      : path.resolve(serverRoot, parsed.data.UPLOADS_DIRECTORY),
    googleEnabled: Boolean(
      parsed.data.GOOGLE_CLIENT_ID && parsed.data.GOOGLE_CLIENT_SECRET && parsed.data.GOOGLE_CALLBACK_URL,
    ),
    passwordResetEmailEnabled: Boolean(
      parsed.data.GOOGLE_CLIENT_ID &&
      parsed.data.GOOGLE_CLIENT_SECRET &&
      parsed.data.GOOGLE_GMAIL_REFRESH_TOKEN &&
      parsed.data.GOOGLE_GMAIL_SENDER,
    ),
  };
  return cachedEnv;
}

export function resetEnvForTests(): void {
  cachedEnv = undefined;
}
