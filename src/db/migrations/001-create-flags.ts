import type { Migration } from './types';

export const migration: Migration = {
  id: '001',
  name: 'create-flags',
  sql: `
    CREATE TABLE IF NOT EXISTS flags (
      id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `,
};
