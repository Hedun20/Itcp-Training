import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const serverRoot = path.resolve(__dirname, '../..');
// npm workspace scripts run with the package as cwd; load the repository-level env deliberately.
dotenv.config({ path: path.resolve(serverRoot, '../.env'), quiet: true });

const booleanFromString = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  return value.toLowerCase() === 'true';
}, z.boolean());

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().url().optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    CLIENT_URL: z.string().url().default('http://localhost:5173'),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/, 'Use a duration such as 15m, 1h, or 1d').default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    REFRESH_COOKIE_NAME: z.string().min(1).default('itcp_refresh'),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SECURE: booleanFromString.optional(),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
    UPLOAD_MAX_BYTES: z.coerce.number().int().min(1_024).max(25 * 1024 * 1024).default(5 * 1024 * 1024),
    UPLOADS_DIRECTORY: z.string().min(1).default('uploads'),
    GOOGLE_CLIENT_ID: optionalNonEmptyString,
    GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
    GOOGLE_CALLBACK_URL: optionalUrl,
    ADMIN_NAME: z.string().min(2).optional(),
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(12).optional(),
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
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT refresh and access secrets must be different',
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
  };
  return cachedEnv;
}

export function resetEnvForTests(): void {
  cachedEnv = undefined;
}
