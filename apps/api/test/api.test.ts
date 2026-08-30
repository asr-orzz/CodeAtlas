import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { BoardStore } from "../src/board-store.js";
import { ProjectStore } from "../src/store.js";

// The analyzer fixture doubles as a small realistic project to analyze.
const fixtureDir = fileURLToPath(
  new URL("../../../packages/analyzer/test/fixtures/sample", import.meta.url),
);

function freshApp(prefix = "archx-") {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  return createApp(new ProjectStore(dir), new BoardStore(dir));
}

const app = freshApp();

describe("API", () => {
  let projectId = "";

  beforeAll(async () => {
    const res = await request(app).post("/api/analyze").send({ path: fixtureDir });
    expect(res.status).toBe(201);
    projectId = res.body.id;
  });

  it("analyzes a directory and reports a layered architecture", async () => {
    const res = await request(app).get(`/api/projects/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.report.isLayered).toBe(true);
    expect(res.body.ir.nodes.length).toBeGreaterThan(0);
  });

  it("lists analyzed projects", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(200);
    expect(res.body.projects.some((p: { id: string }) => p.id === projectId)).toBe(true);
  });

  it("serves a class diagram", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/diagram/class`);
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("class");
    expect(res.body.nodes.length).toBe(6); // 4 classes + 2 interfaces
  });

  it("serves a traced sequence diagram", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/diagram/sequence`);
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("sequence");
    const labels = res.body.edges
      .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
      .map((e: { label: string }) => e.label);
    expect(labels).toContain("findById");
  });

  it("serves the dependency graph view", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/graph/dependency`);
    expect(res.status).toBe(200);
    expect(res.body.view).toBe("dependency");
    expect(res.body.edges.every((e: { kind: string }) => e.kind !== "calls")).toBe(true);
  });

  it("serves a laid-out dependency diagram", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/diagram/dependency`);
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("dependency");
    expect(res.body.nodes.every((n: { type: string }) => n.type === "entity")).toBe(true);
  });

  it("explains the architecture via the AI assistant", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/ai/explain`);
    expect(res.status).toBe(200);
    expect(res.body.text).toContain("Architecture overview");
  });

  it("returns detected smells", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/ai/smells`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.smells)).toBe(true);
  });

  it("answers questions deterministically", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/ai/ask`)
      .send({ question: "explain the architecture" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("deterministic");
    expect(typeof res.body.answer).toBe("string");
  });

  it("rejects an empty question", async () => {
    const res = await request(app).post(`/api/projects/${projectId}/ai/ask`).send({});
    expect(res.status).toBe(400);
  });

  it("answers a graph command with a canvas action", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/ai/ask`)
      .send({ question: "focus UserService" });
    expect(res.status).toBe(200);
    expect(res.body.action?.type).toBe("focusNode");
  });

  it("queries a node's dependencies", async () => {
    const detail = await request(app).get(`/api/projects/${projectId}`);
    const service = detail.body.ir.nodes.find(
      (n: { name: string }) => n.name === "UserService",
    );
    expect(service).toBeTruthy();
    const res = await request(app).get(
      `/api/projects/${projectId}/nodes/${encodeURIComponent(service.id)}/dependencies`,
    );
    expect(res.status).toBe(200);
    expect(res.body.relation).toBe("dependencies");
    expect(Array.isArray(res.body.nodes)).toBe(true);
  });

  it("returns 404 for unknown projects", async () => {
    const res = await request(app).get("/api/projects/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("rejects analyze without a path", async () => {
    const res = await request(app).post("/api/analyze").send({});
    expect(res.status).toBe(400);
  });
});

describe("Boards", () => {
  const boardApp = freshApp("archx-boards-");
  let projectId = "";

  beforeAll(async () => {
    const res = await request(boardApp).post("/api/analyze").send({ path: fixtureDir });
    projectId = res.body.id;
  });

  it("creates a board seeded from the class diagram", async () => {
    const res = await request(boardApp)
      .post(`/api/projects/${projectId}/boards`)
      .send({ name: "My board", seedKind: "class" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("My board");
    expect(res.body.nodes.length).toBeGreaterThan(0);
  });

  it("saves and reloads edits, dropping dangling edges", async () => {
    const created = await request(boardApp)
      .post(`/api/projects/${projectId}/boards`)
      .send({ name: "Editable" });
    const boardId = created.body.id;

    const save = await request(boardApp)
      .put(`/api/boards/${boardId}`)
      .send({
        name: "Renamed",
        nodes: [
          { id: "a", type: "class", label: "A", x: 0, y: 0, width: 160, height: 60 },
          { id: "b", type: "service", label: "B", x: 200, y: 0, width: 160, height: 60 },
        ],
        edges: [
          { id: "e1", source: "a", target: "b", type: "association" },
          { id: "e2", source: "a", target: "ghost", type: "calls" },
        ],
      });
    expect(save.status).toBe(200);
    expect(save.body.name).toBe("Renamed");
    expect(save.body.edges.length).toBe(1); // dangling e2 dropped

    const reload = await request(boardApp).get(`/api/boards/${boardId}`);
    expect(reload.body.nodes.length).toBe(2);
  });

  it("lists boards and deletes them", async () => {
    const list = await request(boardApp).get(`/api/projects/${projectId}/boards`);
    expect(list.status).toBe(200);
    expect(list.body.boards.length).toBeGreaterThanOrEqual(2);

    const del = await request(boardApp).delete(`/api/boards/${list.body.boards[0].id}`);
    expect(del.status).toBe(204);
  });

  it("returns 404 for a missing board", async () => {
    const res = await request(boardApp).get("/api/boards/nope");
    expect(res.status).toBe(404);
  });
});

describe("GitHub import route", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "archx-gh-route-"));
  const ghApp = createApp(new ProjectStore(dir), new BoardStore(dir), {
    cloner: () => ({
      dir: fixtureDir,
      commit: "deadbeef",
      branch: "main",
      cleanup: () => {},
    }),
  });

  it("imports a repository via a stubbed clone", async () => {
    const res = await request(ghApp)
      .post("/api/analyze/github")
      .send({ url: "octo/demo" });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe("https://github.com/octo/demo");
    expect(res.body.meta.commit).toBe("deadbeef");
    expect(res.body.report.nodeCount).toBeGreaterThan(0);
  });

  it("rejects import without a url", async () => {
    const res = await request(ghApp).post("/api/analyze/github").send({});
    expect(res.status).toBe(400);
  });
});
