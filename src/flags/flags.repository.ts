import { pool } from '../db/pool';

export type Flag = {
  id: number;
  key: string;
  description: string;
  enabled: boolean;
  created_at: string;
};

export interface FlagCreateInput {
  key: string;
  description: string;
  enabled: boolean;
}

export interface FlagUpdateInput {
  description: string;
  enabled: boolean;
}

const COLUMNS = 'id, key, description, enabled, created_at';

export async function findAll(): Promise<Flag[]> {
  const { rows } = await pool.query<Flag>(`SELECT ${COLUMNS} FROM flags ORDER BY key`);
  return rows;
}

export async function findByKey(key: string): Promise<Flag | null> {
  const { rows } = await pool.query<Flag>(
    `SELECT ${COLUMNS} FROM flags WHERE key = $1`,
    [key],
  );
  return rows[0] ?? null;
}

export async function create(input: FlagCreateInput): Promise<Flag> {
  const { rows } = await pool.query<Flag>(
    `INSERT INTO flags (key, description, enabled) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [input.key, input.description, input.enabled],
  );
  return rows[0];
}

export async function update(key: string, input: FlagUpdateInput): Promise<Flag | null> {
  const { rows } = await pool.query<Flag>(
    `UPDATE flags SET description = $1, enabled = $2 WHERE key = $3 RETURNING ${COLUMNS}`,
    [input.description, input.enabled, key],
  );
  return rows[0] ?? null;
}

export async function remove(key: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM flags WHERE key = $1', [key]);
  return (result.rowCount ?? 0) > 0;
}
