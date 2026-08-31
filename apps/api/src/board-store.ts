import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

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
  userId: string;
  /** Null for standalone, hand-drawn boards not tied to an analyzed project. */
  projectId: string | null;
  name: string;
  nodes: BoardNode[];
  edges: BoardEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardSummary {
  id: string;
  projectId: string | null;
  name: string;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
}

export type BoardContent = Pick<Board, "nodes" | "edges"> & { name?: string };

/** Per-user board persistence. Implemented over Postgres and in memory. */
export interface BoardStore {
  create(
    userId: string,
    projectId: string | null,
    name: string,
    content?: BoardContent,
  ): Promise<Board>;
  get(userId: string, id: string): Promise<Board | undefined>;
  listByProject(userId: string, projectId: string): Promise<BoardSummary[]>;
  /** Standalone boards (no project) owned by the user. */
  listStandalone(userId: string): Promise<BoardSummary[]>;
  update(
    userId: string,
    id: string,
    content: BoardContent,
  ): Promise<Board | undefined>;
  delete(userId: string, id: string): Promise<boolean>;
  deleteByProject(userId: string, projectId: string): Promise<void>;
}

function summarize(b: Board): BoardSummary {
  return {
    id: b.id,
    projectId: b.projectId,
    name: b.name,
    nodeCount: b.nodes.length,
    edgeCount: b.edges.length,
    updatedAt: b.updatedAt,
  };
}

/** Postgres-backed board store (production). */
export class PgBoardStore implements BoardStore {
  constructor(private readonly pool: Pool) {}

  async create(
    userId: string,
    projectId: string | null,
    name: string,
    content?: BoardContent,
  ): Promise<Board> {
    const now = new Date().toISOString();
    const board: Board = {
      id: randomUUID(),
      userId,
      projectId,
      name,
      nodes: content?.nodes ?? [],
      edges: content?.edges ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await this.pool.query(
      `INSERT INTO boards
         (id, user_id, project_id, name, nodes, edges, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8)`,
      [
        board.id,
        userId,
        projectId,
        board.name,
        JSON.stringify(board.nodes),
        JSON.stringify(board.edges),
        board.createdAt,
        board.updatedAt,
      ],
    );
    return board;
  }

  async get(userId: string, id: string): Promise<Board | undefined> {
    const { rows } = await this.pool.query(
      `SELECT * FROM boards WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ? this.fromRow(rows[0]) : undefined;
  }

  async listByProject(
    userId: string,
    projectId: string,
  ): Promise<BoardSummary[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM boards WHERE user_id = $1 AND project_id = $2
       ORDER BY updated_at DESC`,
      [userId, projectId],
    );
    return rows.map((r) => summarize(this.fromRow(r)));
  }

  async listStandalone(userId: string): Promise<BoardSummary[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM boards WHERE user_id = $1 AND project_id IS NULL
       ORDER BY updated_at DESC`,
      [userId],
    );
    return rows.map((r) => summarize(this.fromRow(r)));
  }

  async update(
    userId: string,
    id: string,
    content: BoardContent,
  ): Promise<Board | undefined> {
    const board = await this.get(userId, id);
    if (!board) return undefined;
    const updated: Board = {
      ...board,
      name: content.name?.trim() ? content.name.trim() : board.name,
      nodes: content.nodes,
      edges: content.edges,
      updatedAt: new Date().toISOString(),
    };
    await this.pool.query(
      `UPDATE boards SET name = $1, nodes = $2::jsonb, edges = $3::jsonb, updated_at = $4
       WHERE id = $5 AND user_id = $6`,
      [
        updated.name,
        JSON.stringify(updated.nodes),
        JSON.stringify(updated.edges),
        updated.updatedAt,
        id,
        userId,
      ],
    );
    return updated;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM boards WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async deleteByProject(userId: string, projectId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM boards WHERE user_id = $1 AND project_id = $2`,
      [userId, projectId],
    );
  }

  private fromRow(row: {
    id: string;
    user_id: string;
    project_id: string | null;
    name: string;
    nodes: BoardNode[];
    edges: BoardEdge[];
    created_at: string;
    updated_at: string;
  }): Board {
    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      name: row.name,
      nodes: row.nodes,
      edges: row.edges,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}

/** In-memory board store (tests / ephemeral use). */
export class MemoryBoardStore implements BoardStore {
  private readonly boards = new Map<string, Board>();

  async create(
    userId: string,
    projectId: string | null,
    name: string,
    content?: BoardContent,
  ): Promise<Board> {
    const now = new Date().toISOString();
    const board: Board = {
      id: randomUUID(),
      userId,
      projectId,
      name,
      nodes: content?.nodes ?? [],
      edges: content?.edges ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.boards.set(board.id, board);
    return board;
  }

  async get(userId: string, id: string): Promise<Board | undefined> {
    const b = this.boards.get(id);
    return b && b.userId === userId ? b : undefined;
  }

  async listByProject(
    userId: string,
    projectId: string,
  ): Promise<BoardSummary[]> {
    return [...this.boards.values()]
      .filter((b) => b.userId === userId && b.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(summarize);
  }

  async listStandalone(userId: string): Promise<BoardSummary[]> {
    return [...this.boards.values()]
      .filter((b) => b.userId === userId && b.projectId === null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(summarize);
  }

  async update(
    userId: string,
    id: string,
    content: BoardContent,
  ): Promise<Board | undefined> {
    const board = this.boards.get(id);
    if (!board || board.userId !== userId) return undefined;
    const updated: Board = {
      ...board,
      name: content.name?.trim() ? content.name.trim() : board.name,
      nodes: content.nodes,
      edges: content.edges,
      updatedAt: new Date().toISOString(),
    };
    this.boards.set(id, updated);
    return updated;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const b = this.boards.get(id);
    if (!b || b.userId !== userId) return false;
    return this.boards.delete(id);
  }

  async deleteByProject(userId: string, projectId: string): Promise<void> {
    for (const b of [...this.boards.values()]) {
      if (b.userId === userId && b.projectId === projectId) {
        this.boards.delete(b.id);
      }
    }
  }
}
