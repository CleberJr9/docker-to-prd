import express, { type Express } from 'express';
import { errorHandler } from './http/error-handler';
import { healthRouter } from './health/health.router';
import { flagsRouter } from './flags/flags.router';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.use('/health', healthRouter);
  app.use('/flags', flagsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  app.use(errorHandler);

  return app;
}
