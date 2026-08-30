import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { ArchitectureGraph } from "@archx/core";
import type { ArchitectureReport } from "@archx/architecture";
import { openDb } from "./db.js";

export interface ProjectRecord {
  id: string;
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

interface ProjectRow {
  id: string;
  name: string;
  source: string;
  createdAt: string;
  nodeCount: number;
  edgeCount: number;
  cycleCount: number;
  ir: string;
  report: string;
}

/**
 * Persistent, SQLite-backed project store. Each analysis is a row in a real
 * database file (`codeatlas.db`), so everything survives restarts and scales
 * far past a folder full of JSON files. The public API is unchanged.
 */
export class ProjectStore {
  private readonly db: Database.Database;

  constructor(dataDir: string) {
    this.db = openDb(dataDir);
    this.migrateLegacyJson(dataDir);
  }

  /** One-time import of pre-database `data/projects/*.json` files. */
  private migrateLegacyJson(dataDir: string): void {
    const legacyDir = path.join(dataDir, "projects");
    if (!fs.existsSync(legacyDir)) return;
    const count = this.db
      .prepare("SELECT COUNT(*) AS n FROM projects")
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
        const record = JSON.parse(raw) as ProjectRecord;
        if (record.id) this.insert(record);
      } catch {
        // Skip corrupt legacy files rather than crash on startup.
      }
    }
  }

  private insert(record: ProjectRecord): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO projects
           (id, name, source, createdAt, nodeCount, edgeCount, cycleCount, ir, report)
         VALUES (@id, @name, @source, @createdAt, @nodeCount, @edgeCount, @cycleCount, @ir, @report)`,
      )
      .run({
        id: record.id,
        name: record.name,
        source: record.source,
        createdAt: record.createdAt,
        nodeCount: record.ir.nodes.length,
        edgeCount: record.ir.edges.length,
        cycleCount: record.report.cycles.length,
        ir: JSON.stringify(record.ir),
        report: JSON.stringify(record.report),
      });
  }

  create(input: Omit<ProjectRecord, "id" | "createdAt">): ProjectRecord {
    const record: ProjectRecord = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.insert(record);
    return record;
  }

  get(id: string): ProjectRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as ProjectRow | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      source: row.source,
      createdAt: row.createdAt,
      ir: JSON.parse(row.ir) as ArchitectureGraph,
      report: JSON.parse(row.report) as ArchitectureReport,
    };
  }

  list(): ProjectSummary[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, source, createdAt, nodeCount, edgeCount, cycleCount
         FROM projects ORDER BY createdAt DESC`,
      )
      .all() as Omit<ProjectRow, "ir" | "report">[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      source: r.source,
      createdAt: r.createdAt,
      nodeCount: r.nodeCount,
      edgeCount: r.edgeCount,
      cycleCount: r.cycleCount,
    }));
  }

  delete(id: string): boolean {
    const info = this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return info.changes > 0;
  }
}
