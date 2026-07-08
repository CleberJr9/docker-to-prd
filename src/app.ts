import express, { type Express } from 'express';
import { errorHandler } from './http/error-handler';
import { healthRouter } from './health/health.router';
import { peopleRouter } from './people/people.router';

// Monta a instância do Express. Exportada separadamente do bootstrap para
// manter a configuração de rotas isolada do ciclo de vida do processo.
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.use('/health', healthRouter);
  app.use('/people', peopleRouter);

  // 404 para rotas não mapeadas.
  app.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  // Error handler central (deve ser o último middleware).
  app.use(errorHandler);

  return app;
}
