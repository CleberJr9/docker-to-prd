import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../db/pool';

export interface Person {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface PersonInput {
  name: string;
  email: string;
}

type PersonRow = Person & RowDataPacket;

const COLUMNS = 'id, name, email, created_at';

export async function findAll(): Promise<Person[]> {
  const [rows] = await pool.query<PersonRow[]>(`SELECT ${COLUMNS} FROM people ORDER BY id`);
  return rows;
}

export async function findById(id: number): Promise<Person | null> {
  const [rows] = await pool.query<PersonRow[]>(
    `SELECT ${COLUMNS} FROM people WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export async function create(input: PersonInput): Promise<Person> {
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO people (name, email) VALUES (?, ?)',
    [input.name, input.email],
  );
  const created = await findById(result.insertId);
  // Recém-inserido: sempre existe.
  return created as Person;
}

export async function update(id: number, input: PersonInput): Promise<Person | null> {
  const existing = await findById(id);
  if (!existing) {
    return null;
  }
  await pool.query('UPDATE people SET name = ?, email = ? WHERE id = ?', [
    input.name,
    input.email,
    id,
  ]);
  return findById(id);
}

export async function remove(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM people WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
