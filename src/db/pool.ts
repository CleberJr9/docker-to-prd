import mysql from 'mysql2/promise';
import { env } from '../config/env';

// Pool único de conexões compartilhado pela aplicação. A criação é preguiçosa:
// nenhuma conexão é aberta até a primeira query.
export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
