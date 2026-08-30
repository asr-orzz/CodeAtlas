import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ArchitectureGraph } from "@archx/core";
import type { ArchitectureReport } from "@archx/architecture";

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

function summarize(record: ProjectRecord): ProjectSummary {
  return {
    id: record.id,
    name: record.name,
    source: record.source,
    createdAt: record.createdAt,
    nodeCount: record.ir.nodes.length,
    edgeCount: record.ir.edges.length,
    cycleCount: record.report.cycles.length,
  };
}

/**
 * A tiny JSON-file-backed project store. Keeps everything in memory and mirrors
 * each record to disk so analyses survive a server restart — no database needed.
 */
export class ProjectStore {
  private readonly projectsDir: string;
  private readonly records = new Map<string, ProjectRecord>();

  constructor(dataDir: string) {
    this.projectsDir = path.join(dataDir, "projects");
    fs.mkdirSync(this.projectsDir, { recursive: true });
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    let files: string[] = [];
    try {
      files = fs.readdirSync(this.projectsDir).filter((f) => f.endsWith(".json"));
    } catch {
      return;
    }
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this.projectsDir, file), "utf8");
        const record = JSON.parse(raw) as ProjectRecord;
        if (record.id) this.records.set(record.id, record);
      } catch {
        // Skip corrupt files rather than crash the server.
      }
    }
  }

  private persist(record: ProjectRecord): void {
    const file = path.join(this.projectsDir, `${record.id}.json`);
    fs.writeFileSync(file, JSON.stringify(record), "utf8");
  }

  create(input: Omit<ProjectRecord, "id" | "createdAt">): ProjectRecord {
    const record: ProjectRecord = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.records.set(record.id, record);
    this.persist(record);
    return record;
  }

  get(id: string): ProjectRecord | undefined {
    return this.records.get(id);
  }

  list(): ProjectSummary[] {
    return [...this.records.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(summarize);
  }

  delete(id: string): boolean {
    const existed = this.records.delete(id);
    if (existed) {
      try {
        fs.rmSync(path.join(this.projectsDir, `${id}.json`));
      } catch {
        // ignore
      }
    }
    return existed;
  }
}
