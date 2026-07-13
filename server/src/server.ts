import http from 'node:http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { getEnv } from './config/env';

async function start(): Promise<void> {
  const env = getEnv();
  try {
    await connectDatabase();
  } catch (error) {
    console.error('MongoDB connection failed. Verify MONGODB_URI and that MongoDB is reachable.', error);
    process.exitCode = 1;
    return;
  }

  const server = http.createServer(createApp());
  server.listen(env.PORT, () => console.log(`ITCP Training API listening on port ${env.PORT}`));

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; shutting down gracefully`);
    const forceTimer = setTimeout(() => process.exit(1), 10_000).unref();
    server.close(async () => {
      await disconnectDatabase().catch((error) => console.error('MongoDB disconnect failed', error));
      clearTimeout(forceTimer);
      process.exit(0);
    });
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (error) => console.error('Unhandled promise rejection', error));
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception', error);
    void shutdown('uncaughtException');
  });
}

void start();
