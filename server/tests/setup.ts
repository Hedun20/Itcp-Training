import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
process.env.ACCESS_TOKEN_TTL = '15m';
process.env.REFRESH_TOKEN_TTL_DAYS = '7';
process.env.REFRESH_COOKIE_NAME = 'itcp_refresh';
process.env.UPLOADS_DIRECTORY = path.resolve(__dirname, '../uploads');
process.env.UPLOAD_MAX_BYTES = '1024';
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.GOOGLE_CALLBACK_URL = '';
process.env.COOKIE_SECURE = '';
process.env.TRUST_PROXY = '1';
process.env.SEED_UPDATE_EXISTING = 'false';
process.env.INSTRUCTOR_REGISTRATION_ENABLED = 'true';
process.env.INSTRUCTOR_REGISTRATION_CODE = '482731';
process.env.INSTRUCTOR_CODE_MAX_ATTEMPTS = '5';
process.env.INSTRUCTOR_CODE_WINDOW_MINUTES = '30';
process.env.ADMIN_NAME = 'Configured Seed Administrator';
process.env.ADMIN_EMAIL = 'seed-admin@example.com';
process.env.ADMIN_PASSWORD = 'ConfiguredAdmin123!';

let memoryServer: MongoMemoryServer;

beforeAll(async () => {
  memoryServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memoryServer.getUri('itcp_training_test');
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});
