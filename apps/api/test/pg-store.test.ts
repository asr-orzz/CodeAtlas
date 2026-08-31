import { newDb } from "pg-mem";
import type { Pool } from "pg";
import { emptyGraph, type ArchitectureGraph } from "@archx/core";
import { computeArchitectureReport } from "@archx/architecture";
import { beforeAll, describe, expect, it } from "vitest";
import { PgUserStore } from "../src/auth.js";
import { PgBoardStore } from "../src/board-store.js";
import { initSchema } from "../src/db.js";
import { PgProjectStore } from "../src/store.js";

/** A pg-compatible Pool backed by an in-memory Postgres (validates real SQL). */
function memoryPool(): Pool {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  return new Pool() as unknown as Pool;
}

function sampleIR(): ArchitectureGraph {
  const g = emptyGraph();
  g.nodes = [
    { id: "a", kind: "class", name: "A", filePath: "a.ts" },
    { id: "b", kind: "class", name: "B", filePath: "b.ts" },
  ];
  g.edges = [{ id: "e1", source: "a", target: "b", kind: "dependency" }];
  return g;
}

describe("Postgres stores (pg-mem)", () => {
  const pool = memoryPool();
  const users = new PgUserStore(pool);
  const projects = new PgProjectStore(pool);
  const boards = new PgBoardStore(pool);
  let userId = "";
  let otherId = "";

  beforeAll(async () => {
    await initSchema(pool);
    const u = await users.create("a@b.com", "A", "hash");
    userId = u.id;
    const o = await users.create("c@d.com", "C", "hash");
    otherId = o.id;
  });

  it("creates users and finds them by email/id", async () => {
    const byEmail = await users.findByEmail("a@b.com");
    expect(byEmail?.passwordHash).toBe("hash");
    const byId = await users.findById(userId);
    expect(byId?.email).toBe("a@b.com");
  });

  it("persists a project with jsonb IR and lists a summary", async () => {
    const ir = sampleIR();
    const report = computeArchitectureReport(ir);
    const created = await projects.create(userId, {
      name: "demo",
      source: "local",
      ir,
      report,
    });
    expect(created.userId).toBe(userId);

    const fetched = await projects.get(userId, created.id);
    expect(fetched?.ir.nodes.length).toBe(2);
    expect(fetched?.ir.edges[0]?.kind).toBe("dependency");

    const list = await projects.list(userId);
    expect(list).toHaveLength(1);
    expect(list[0]?.nodeCount).toBe(2);
    expect(list[0]?.edgeCount).toBe(1);
  });

  it("scopes projects to their owner", async () => {
    expect(await projects.list(otherId)).toHaveLength(0);
    const list = await projects.list(userId);
    const id = list[0]!.id;
    expect(await projects.get(otherId, id)).toBeUndefined();
  });

  it("creates, updates and deletes boards", async () => {
    const project = (await projects.list(userId))[0]!;
    const board = await boards.create(userId, project.id, "Board", {
      nodes: [{ id: "n1", type: "class", label: "N1", x: 0, y: 0, width: 100, height: 40 }],
      edges: [],
    });
    expect(board.nodes).toHaveLength(1);

    const updated = await boards.update(userId, board.id, {
      name: "Renamed",
      nodes: board.nodes,
      edges: [{ id: "x", source: "n1", target: "n1", type: "association" }],
    });
    expect(updated?.name).toBe("Renamed");
    expect(updated?.edges).toHaveLength(1);

    const summaries = await boards.listByProject(userId, project.id);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.edgeCount).toBe(1);

    expect(await boards.delete(userId, board.id)).toBe(true);
    expect(await boards.get(userId, board.id)).toBeUndefined();
  });

  it("deletes a project", async () => {
    const project = (await projects.list(userId))[0]!;
    expect(await projects.delete(userId, project.id)).toBe(true);
    expect(await projects.list(userId)).toHaveLength(0);
  });
});
