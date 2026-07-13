import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getEnv, resetEnvForTests } from '../src/config/env';

const original = {
  NODE_ENV: process.env.NODE_ENV,
  COOKIE_SECURE: process.env.COOKIE_SECURE,
  UPLOADS_DIRECTORY: process.env.UPLOADS_DIRECTORY,
};

afterEach(() => {
  process.env.NODE_ENV = original.NODE_ENV;
  process.env.COOKIE_SECURE = original.COOKIE_SECURE;
  process.env.UPLOADS_DIRECTORY = original.UPLOADS_DIRECTORY;
  resetEnvForTests();
});

describe('environment safety', () => {
  it('treats a blank cookie override as unset and resolves relative uploads against the server package', () => {
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = '';
    process.env.UPLOADS_DIRECTORY = 'uploads';
    resetEnvForTests();
    const env = getEnv();
    expect(env.COOKIE_SECURE).toBeUndefined();
    expect(env.uploadsDirectory).toBe(path.resolve(__dirname, '../uploads'));
  });

  it('rejects an explicitly insecure production cookie configuration', () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECURE = 'false';
    resetEnvForTests();
    expect(() => getEnv()).toThrow('COOKIE_SECURE cannot be false in production');
  });
});
