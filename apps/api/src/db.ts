import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * One shared connection per database file. ProjectStore and BoardStore both open
 * the same file, so sharing avoids competing WAL writers and keeps everything in
 * a single, real, persistent SQLite database.
 */
const connections = new Map<string, Database.Database>();

export function openDb(dataDir: string): Database.Database {
  const file = path.join(dataDir, "codeatlas.db");
  const existing = connections.get(file);
  if (existing) return existing;

  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      source     TEXT NOT NULL,
      createdAt  TEXT NOT NULL,
      nodeCount  INTEGER NOT NULL DEFAULT 0,
      edgeCount  INTEGER NOT NULL DEFAULT 0,
      cycleCount INTEGER NOT NULL DEFAULT 0,
      ir         TEXT NOT NULL,
      report     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boards (
      id         TEXT PRIMARY KEY,
      projectId  TEXT NOT NULL,
      name       TEXT NOT NULL,
      nodes      TEXT NOT NULL,
      edges      TEXT NOT NULL,
      createdAt  TEXT NOT NULL,
      updatedAt  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_boards_project ON boards(projectId);
  `);

  connections.set(file, db);
  return db;
}
