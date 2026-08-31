import { Pool } from "pg";
import { config } from "./config.js";

let pool: Pool | undefined;

/**
 * Lazily create the shared Postgres connection pool from DATABASE_URL. Neon
 * requires TLS; we enable it whenever the URL points at a non-local host.
 */
export function getPool(): Pool {
  if (pool) return pool;
  if (!config.databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. CodeAtlas needs a Postgres connection " +
        "string (e.g. a Neon database URL) to start.",
    );
  }
  const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: local ? undefined : { rejectUnauthorized: false },
    // Fail fast with a clear error instead of hanging on an unreachable host.
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  });
  return pool;
}

/** Create tables if they don't exist. Safe to run on every boot. */
export async function initSchema(db: Pool = getPool()): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          UUID PRIMARY KEY,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      source      TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      node_count  INTEGER NOT NULL DEFAULT 0,
      edge_count  INTEGER NOT NULL DEFAULT 0,
      cycle_count INTEGER NOT NULL DEFAULT 0,
      ir          JSONB NOT NULL,
      report      JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

    CREATE TABLE IF NOT EXISTS boards (
      id         UUID PRIMARY KEY,
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      -- Nullable: a board can be standalone (hand-drawn UML) with no project.
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      nodes      JSONB NOT NULL,
      edges      JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_boards_project ON boards(project_id);
  `);

  // Migrate older databases where boards.project_id was created NOT NULL,
  // so standalone (hand-drawn) boards with no project can be inserted.
  // DROP NOT NULL is idempotent on Postgres and a no-op if already nullable.
  try {
    await db.query(`ALTER TABLE boards ALTER COLUMN project_id DROP NOT NULL;`);
  } catch {
    // Table was just created (already nullable) or backend doesn't support it.
  }
}
