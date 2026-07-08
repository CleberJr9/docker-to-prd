import mysql from 'mysql2/promise';
import { env } from '../config/env';
import { migrations } from './migrations';

// Runner de migrações próprio, sem dependência externa.
//
// - Cria a tabela `schema_migrations` (registro do que já foi aplicado).
// - Aplica, em ordem, apenas as migrações ainda não registradas.
// - É idempotente: rodar duas vezes seguidas não aplica nada na segunda vez.
// - Não faz retry: se o banco estiver inacessível, falha com mensagem clara
//   e exit code 1. Orquestrar a ordem de subida é responsabilidade de quem
//   monta o ambiente.
//
// Usa um pool dedicado (com multipleStatements habilitado) para não impor esse
// comportamento ao pool da aplicação.

async function ensureMigrationsTable(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function getAppliedIds(pool: mysql.Pool): Promise<Set<string>> {
  const [rows] = await pool.query('SELECT id FROM schema_migrations');
  const ids = (rows as Array<{ id: string }>).map((row) => row.id);
  return new Set(ids);
}

async function migrate(): Promise<void> {
  const pool = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });

  try {
    await ensureMigrationsTable(pool);
    const applied = await getAppliedIds(pool);
    const pending = migrations.filter((m) => !applied.has(m.id));

    if (pending.length === 0) {
      console.log('Nenhuma migração pendente.');
      return;
    }

    for (const m of pending) {
      console.log(`Aplicando migração ${m.id} - ${m.name}...`);
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(m.sql);
        await conn.query('INSERT INTO schema_migrations (id, name) VALUES (?, ?)', [m.id, m.name]);
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    console.log(`Concluído. ${pending.length} migração(ões) aplicada(s).`);
  } finally {
    await pool.end();
  }
}

migrate()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Falha ao aplicar migrações: ${message}`);
    process.exit(1);
  });
