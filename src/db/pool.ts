import { Pool } from 'pg';
import { env } from '../config/env';

// Pool único de conexões compartilhado pela aplicação. A criação é preguiçosa:
// nenhuma conexão é aberta até a primeira query.
export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  max: 10,
});
