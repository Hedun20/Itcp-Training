import { Router } from 'express';
import { databaseState } from '../config/database';

const router = Router();

router.get('/', (_request, response) => {
  const database = databaseState();
  response.status(database === 'connected' ? 200 : 503).json({
    data: {
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
});

export { router as healthRoutes };
