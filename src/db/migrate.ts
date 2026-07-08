import { Pool } from 'pg';
import { env } from '../config/env';
import { migrations } from './migrations';

// Runner de migrações próprio, sem dependência externa.
//
// - Cria a tabela `schema_migrations` (registro do que já foi aplicado).
// - Aplica, em ordem, apenas as migrações ainda não registradas.
// - É idempotente: rodar duas vezes seguidas não aplica nada na segunda vez.
// - Uma transação por migração (Postgres tem DDL transacional, então a criação
//   da tabela e o registro em schema_migrations são atômicos).
// - Não faz retry: se o banco estiver inacessível, falha com mensagem clara
//   e exit code 1. Orquestrar a ordem de subida é responsabilidade de quem
//   monta o ambiente.
//
// Usa um pool dedicado para não interferir no pool da aplicação.

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedIds(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM schema_migrations');
  return new Set(rows.map((row) => row.id));
}

async function migrate(): Promise<void> {
  const pool = new Pool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    max: 5,
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
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [m.id, m.name]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
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
