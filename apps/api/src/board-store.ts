import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { openDb } from "./db.js";

export interface BoardNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: {
    properties?: Array<{ name: string; type?: string; visibility?: string }>;
    methods?: Array<{ name: string; returnType?: string; visibility?: string }>;
    group?: string;
    [key: string]: unknown;
  };
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
}

export interface Board {
  id: string;
  projectId: string;
  name: string;
  nodes: BoardNode[];
  edges: BoardEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardSummary {
  id: string;
  projectId: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
}

export type BoardContent = Pick<Board, "nodes" | "edges"> & { name?: string };

interface BoardRow {
  id: string;
  projectId: string;
  name: string;
  nodes: string;
  edges: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Persistent, SQLite-backed store for manually edited boards. Shares the same
 * `codeatlas.db` file as ProjectStore. The public API is unchanged.
 */
export class BoardStore {
  private readonly db: Database.Database;

  constructor(dataDir: string) {
    this.db = openDb(dataDir);
    this.migrateLegacyJson(dataDir);
  }

  /** One-time import of pre-database `data/boards/*.json` files. */
  private migrateLegacyJson(dataDir: string): void {
    const legacyDir = path.join(dataDir, "boards");
    if (!fs.existsSync(legacyDir)) return;
    const count = this.db
      .prepare("SELECT COUNT(*) AS n FROM boards")
      .get() as { n: number };
    if (count.n > 0) return;

    let files: string[] = [];
    try {
      files = fs.readdirSync(legacyDir).filter((f) => f.endsWith(".json"));
    } catch {
      return;
    }
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(legacyDir, file), "utf8");
        const board = JSON.parse(raw) as Board;
        if (board.id) this.write(board);
      } catch {
        // Skip corrupt legacy files rather than crash on startup.
      }
    }
  }

  private write(board: Board): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO boards
           (id, projectId, name, nodes, edges, createdAt, updatedAt)
         VALUES (@id, @projectId, @name, @nodes, @edges, @createdAt, @updatedAt)`,
      )
      .run({
        id: board.id,
        projectId: board.projectId,
        name: board.name,
        nodes: JSON.stringify(board.nodes),
        edges: JSON.stringify(board.edges),
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
      });
  }

  private fromRow(row: BoardRow): Board {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      nodes: JSON.parse(row.nodes) as BoardNode[],
      edges: JSON.parse(row.edges) as BoardEdge[],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  create(projectId: string, name: string, content?: BoardContent): Board {
    const now = new Date().toISOString();
    const board: Board = {
      id: randomUUID(),
      projectId,
      name,
      nodes: content?.nodes ?? [],
      edges: content?.edges ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.write(board);
    return board;
  }

  get(id: string): Board | undefined {
    const row = this.db
      .prepare("SELECT * FROM boards WHERE id = ?")
      .get(id) as BoardRow | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  listByProject(projectId: string): BoardSummary[] {
    const rows = this.db
      .prepare(
        `SELECT id, projectId, name, nodes, edges, updatedAt
         FROM boards WHERE projectId = ? ORDER BY updatedAt DESC`,
      )
      .all(projectId) as BoardRow[];
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      name: r.name,
      nodeCount: (JSON.parse(r.nodes) as unknown[]).length,
      edgeCount: (JSON.parse(r.edges) as unknown[]).length,
      updatedAt: r.updatedAt,
    }));
  }

  update(id: string, content: BoardContent): Board | undefined {
    const board = this.get(id);
    if (!board) return undefined;
    const updated: Board = {
      ...board,
      name: content.name?.trim() ? content.name.trim() : board.name,
      nodes: content.nodes,
      edges: content.edges,
      updatedAt: new Date().toISOString(),
    };
    this.write(updated);
    return updated;
  }

  delete(id: string): boolean {
    const info = this.db.prepare("DELETE FROM boards WHERE id = ?").run(id);
    return info.changes > 0;
  }

  deleteByProject(projectId: string): void {
    this.db.prepare("DELETE FROM boards WHERE projectId = ?").run(projectId);
  }
}
