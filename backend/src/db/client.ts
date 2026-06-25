// ─── Database client ──────────────────────────────────
// Drizzle ORM over mysql2. The whole schema is registered so callers can
// use relational queries via `db.query.*`.

import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../ontology/schema.js';
import { loadEnv } from '../scripts/env.js';

loadEnv();

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (DB_HOST && DB_USER && DB_PASSWORD && DB_NAME) {
    const port = DB_PORT ?? '3306';
    return `mysql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${port}/${DB_NAME}`;
  }
  return 'mysql://syphonix:syphonix@localhost:3306/syphonix';
}

export const DATABASE_URL = buildDatabaseUrl();

export const queryClient = mysql.createPool(DATABASE_URL);
export const db = drizzle(queryClient, { schema, mode: 'default' });

export type DB = typeof db;
