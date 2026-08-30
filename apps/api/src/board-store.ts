import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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

function summarize(board: Board): BoardSummary {
  return {
    id: board.id,
    projectId: board.projectId,
    name: board.name,
    nodeCount: board.nodes.length,
    edgeCount: board.edges.length,
    updatedAt: board.updatedAt,
  };
}

/**
 * JSON-file-backed store for manually edited boards. Mirrors ProjectStore:
 * everything is held in memory and persisted to disk so boards survive restarts.
 */
export class BoardStore {
  private readonly boardsDir: string;
  private readonly boards = new Map<string, Board>();

  constructor(dataDir: string) {
    this.boardsDir = path.join(dataDir, "boards");
    fs.mkdirSync(this.boardsDir, { recursive: true });
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    let files: string[] = [];
    try {
      files = fs.readdirSync(this.boardsDir).filter((f) => f.endsWith(".json"));
    } catch {
      return;
    }
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this.boardsDir, file), "utf8");
        const board = JSON.parse(raw) as Board;
        if (board.id) this.boards.set(board.id, board);
      } catch {
        // Skip corrupt files rather than crash the server.
      }
    }
  }

  private persist(board: Board): void {
    fs.writeFileSync(
      path.join(this.boardsDir, `${board.id}.json`),
      JSON.stringify(board),
      "utf8",
    );
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
    this.boards.set(board.id, board);
    this.persist(board);
    return board;
  }

  get(id: string): Board | undefined {
    return this.boards.get(id);
  }

  listByProject(projectId: string): BoardSummary[] {
    return [...this.boards.values()]
      .filter((b) => b.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(summarize);
  }

  update(id: string, content: BoardContent): Board | undefined {
    const board = this.boards.get(id);
    if (!board) return undefined;
    const updated: Board = {
      ...board,
      name: content.name?.trim() ? content.name.trim() : board.name,
      nodes: content.nodes,
      edges: content.edges,
      updatedAt: new Date().toISOString(),
    };
    this.boards.set(id, updated);
    this.persist(updated);
    return updated;
  }

  delete(id: string): boolean {
    const existed = this.boards.delete(id);
    if (existed) {
      try {
        fs.rmSync(path.join(this.boardsDir, `${id}.json`));
      } catch {
        // ignore
      }
    }
    return existed;
  }

  deleteByProject(projectId: string): void {
    for (const board of [...this.boards.values()]) {
      if (board.projectId === projectId) this.delete(board.id);
    }
  }
}
