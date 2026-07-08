import { Router } from 'express';
import { pool } from '../db/pool';

export const healthRouter = Router();

// GET /health — saudável (200) quando a aplicação responde e o banco aceita
// uma query trivial; indisponível (503) quando o banco não responde.
healthRouter.get('/', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});
