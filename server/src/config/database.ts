import mongoose from 'mongoose';
import { getEnv } from './env';

export async function connectDatabase(): Promise<typeof mongoose> {
  const env = getEnv();
  mongoose.set('strictQuery', true);
  return mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: env.NODE_ENV === 'production' ? 10_000 : 5_000,
    autoIndex: true,
  });
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

export function databaseState(): string {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] ?? 'unknown';
}
