import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { ArchitectureGraph } from "@archx/core";
import type { ArchitectureReport } from "@archx/architecture";

export interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  /** Where it came from: a local path or a GitHub URL. */
  source: string;
  createdAt: string;
  ir: ArchitectureGraph;
  report: ArchitectureReport;
}

export interface ProjectSummary {
  id: string;
  name: string;
  source: string;
  createdAt: string;
  nodeCount: number;
  edgeCount: number;
  cycleCount: number;
}

export type NewProject = Omit<ProjectRecord, "id" | "userId" | "createdAt">;

/** Per-user project persistence. Implemented over Postgres and in memory. */
export interface ProjectStore {
  create(userId: string, input: NewProject): Promise<ProjectRecord>;
  get(userId: string, id: string): Promise<ProjectRecord | undefined>;
  list(userId: string): Promise<ProjectSummary[]>;
  delete(userId: string, id: string): Promise<boolean>;
}

function summarize(r: ProjectRecord): ProjectSummary {
  return {
    id: r.id,
    name: r.name,
    source: r.source,
    createdAt: r.createdAt,
    nodeCount: r.ir.nodes.length,
    edgeCount: r.ir.edges.length,
    cycleCount: r.report.cycles.length,
  };
}

/** Postgres-backed project store (production). */
export class PgProjectStore implements ProjectStore {
  constructor(private readonly pool: Pool) {}

  async create(userId: string, input: NewProject): Promise<ProjectRecord> {
    const record: ProjectRecord = {
      ...input,
      id: randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
    };
    await this.pool.query(
      `INSERT INTO projects
         (id, user_id, name, source, created_at, node_count, edge_count, cycle_count, ir, report)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
      [
        record.id,
        userId,
        record.name,
        record.source,
        record.createdAt,
        record.ir.nodes.length,
        record.ir.edges.length,
        record.report.cycles.length,
        JSON.stringify(record.ir),
        JSON.stringify(record.report),
      ],
    );
    return record;
  }

  async get(userId: string, id: string): Promise<ProjectRecord | undefined> {
    const { rows } = await this.pool.query(
      `SELECT id, user_id, name, source, created_at, ir, report
       FROM projects WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      source: row.source,
      createdAt: new Date(row.created_at).toISOString(),
      ir: row.ir as ArchitectureGraph,
      report: row.report as ArchitectureReport,
    };
  }

  async list(userId: string): Promise<ProjectSummary[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, source, created_at, node_count, edge_count, cycle_count
       FROM projects WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      source: r.source,
      createdAt: new Date(r.created_at).toISOString(),
      nodeCount: r.node_count,
      edgeCount: r.edge_count,
      cycleCount: r.cycle_count,
    }));
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM projects WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }
}

/** In-memory project store (tests / ephemeral use). */
export class MemoryProjectStore implements ProjectStore {
  private readonly records = new Map<string, ProjectRecord>();

  async create(userId: string, input: NewProject): Promise<ProjectRecord> {
    const record: ProjectRecord = {
      ...input,
      id: randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
    };
    this.records.set(record.id, record);
    return record;
  }

  async get(userId: string, id: string): Promise<ProjectRecord | undefined> {
    const r = this.records.get(id);
    return r && r.userId === userId ? r : undefined;
  }

  async list(userId: string): Promise<ProjectSummary[]> {
    return [...this.records.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(summarize);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const r = this.records.get(id);
    if (!r || r.userId !== userId) return false;
    return this.records.delete(id);
  }
}
