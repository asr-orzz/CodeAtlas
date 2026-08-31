import { fileURLToPath } from "node:url";
import request from "supertest";
import type { Express } from "express";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp, type AppStores } from "../src/app.js";
import { MemoryUserStore } from "../src/auth.js";
import { MemoryBoardStore } from "../src/board-store.js";
import { MemoryProjectStore } from "../src/store.js";
import type { RouteDeps } from "../src/routes.js";

// The analyzer fixture doubles as a small realistic project to analyze.
const fixtureDir = fileURLToPath(
  new URL("../../../packages/analyzer/test/fixtures/sample", import.meta.url),
);

function memoryStores(): AppStores {
  return {
    projects: new MemoryProjectStore(),
    boards: new MemoryBoardStore(),
    users: new MemoryUserStore(),
  };
}

/** Build an app with in-memory stores and a registered, logged-in user. */
async function setup(
  email: string,
  deps: RouteDeps = {},
): Promise<{ app: Express; token: string }> {
  const app = createApp(memoryStores(), deps);
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", name: "Tester" });
  return { app, token: res.body.token as string };
}

describe("API", () => {
  let app: Express;
  let token: string;
  let projectId = "";

  beforeAll(async () => {
    ({ app, token } = await setup("api@example.com"));
    const res = await request(app)
      .post("/api/analyze")
      .set("Authorization", `Bearer ${token}`)
      .send({ path: fixtureDir });
    expect(res.status).toBe(201);
    projectId = res.body.id;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(401);
  });

  it("analyzes a directory and reports a layered architecture", async () => {
    const res = await request(app).get(`/api/projects/${projectId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.report.isLayered).toBe(true);
    expect(res.body.ir.nodes.length).toBeGreaterThan(0);
  });

  it("lists analyzed projects", async () => {
    const res = await request(app).get("/api/projects").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.projects.some((p: { id: string }) => p.id === projectId)).toBe(true);
  });

  it("serves a class diagram", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/diagram/class`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("class");
    expect(res.body.nodes.length).toBe(6); // 4 classes + 2 interfaces
  });

  it("serves a traced sequence diagram", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/diagram/sequence`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("sequence");
    const labels = res.body.edges
      .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
      .map((e: { label: string }) => e.label);
    expect(labels).toContain("findById");
  });

  it("serves the dependency graph view", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/graph/dependency`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.view).toBe("dependency");
    expect(res.body.edges.every((e: { kind: string }) => e.kind !== "calls")).toBe(true);
  });

  it("serves a laid-out dependency diagram", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/diagram/dependency`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("dependency");
    expect(res.body.nodes.every((n: { type: string }) => n.type === "entity")).toBe(true);
  });

  it("explains the architecture via the AI assistant", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/ai/explain`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.text).toContain("Architecture overview");
  });

  it("returns detected smells", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/ai/smells`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.smells)).toBe(true);
  });

  it("answers questions deterministically", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/ai/ask`)
      .set(auth())
      .send({ question: "explain the architecture" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("deterministic");
    expect(typeof res.body.answer).toBe("string");
  });

  it("rejects an empty question", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/ai/ask`)
      .set(auth())
      .send({});
    expect(res.status).toBe(400);
  });

  it("answers a graph command with a canvas action", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/ai/ask`)
      .set(auth())
      .send({ question: "focus UserService" });
    expect(res.status).toBe(200);
    expect(res.body.action?.type).toBe("focusNode");
  });

  it("queries a node's dependencies", async () => {
    const detail = await request(app).get(`/api/projects/${projectId}`).set(auth());
    const service = detail.body.ir.nodes.find(
      (n: { name: string }) => n.name === "UserService",
    );
    expect(service).toBeTruthy();
    const res = await request(app)
      .get(`/api/projects/${projectId}/nodes/${encodeURIComponent(service.id)}/dependencies`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.relation).toBe("dependencies");
    expect(Array.isArray(res.body.nodes)).toBe(true);
  });

  it("rejects an unknown node relation", async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/nodes/whatever/friends`)
      .set(auth());
    expect(res.status).toBe(400);
  });

  it("requires from and to for a path query", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/path`).set(auth());
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await request(app)
      .post("/api/analyze")
      .set(auth())
      .set("Content-Type", "application/json")
      .send("{ not valid json");
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nope").set(auth());
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
  });

  it("returns 404 for unknown projects", async () => {
    const res = await request(app).get("/api/projects/does-not-exist").set(auth());
    expect(res.status).toBe(404);
  });

  it("rejects analyze without a path", async () => {
    const res = await request(app).post("/api/analyze").set(auth()).send({});
    expect(res.status).toBe(400);
  });
});

describe("Boards", () => {
  let app: Express;
  let token: string;
  let projectId = "";
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ({ app, token } = await setup("boards@example.com"));
    const res = await request(app)
      .post("/api/analyze")
      .set(auth())
      .send({ path: fixtureDir });
    projectId = res.body.id;
  });

  it("creates a board seeded from the class diagram", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/boards`)
      .set(auth())
      .send({ name: "My board", seedKind: "class" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("My board");
    expect(res.body.nodes.length).toBeGreaterThan(0);
  });

  it("saves and reloads edits, dropping dangling edges", async () => {
    const created = await request(app)
      .post(`/api/projects/${projectId}/boards`)
      .set(auth())
      .send({ name: "Editable" });
    const boardId = created.body.id;

    const save = await request(app)
      .put(`/api/boards/${boardId}`)
      .set(auth())
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

    const reload = await request(app).get(`/api/boards/${boardId}`).set(auth());
    expect(reload.body.nodes.length).toBe(2);
  });

  it("lists boards and deletes them", async () => {
    const list = await request(app)
      .get(`/api/projects/${projectId}/boards`)
      .set(auth());
    expect(list.status).toBe(200);
    expect(list.body.boards.length).toBeGreaterThanOrEqual(2);

    const del = await request(app)
      .delete(`/api/boards/${list.body.boards[0].id}`)
      .set(auth());
    expect(del.status).toBe(204);
  });

  it("returns 404 for a missing board", async () => {
    const res = await request(app).get("/api/boards/nope").set(auth());
    expect(res.status).toBe(404);
  });

  it("creates and lists standalone boards (no project)", async () => {
    const created = await request(app)
      .post("/api/boards")
      .set(auth())
      .send({ name: "Freehand UML" });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Freehand UML");
    expect(created.body.projectId).toBeNull();

    const list = await request(app).get("/api/boards").set(auth());
    expect(list.status).toBe(200);
    expect(list.body.boards.some((b: { id: string }) => b.id === created.body.id)).toBe(true);

    // Standalone boards must not leak into a project's board list.
    const projectBoards = await request(app)
      .get(`/api/projects/${projectId}/boards`)
      .set(auth());
    expect(
      projectBoards.body.boards.some((b: { id: string }) => b.id === created.body.id),
    ).toBe(false);
  });
});

describe("GitHub import route", () => {
  let app: Express;
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ({ app, token } = await setup("gh@example.com", {
      cloner: () => ({
        dir: fixtureDir,
        commit: "deadbeef",
        branch: "main",
        cleanup: () => {},
      }),
    }));
  });

  it("imports a repository via a stubbed clone", async () => {
    const res = await request(app)
      .post("/api/analyze/github")
      .set(auth())
      .send({ url: "octo/demo" });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe("https://github.com/octo/demo");
    expect(res.body.meta.commit).toBe("deadbeef");
    expect(res.body.report.nodeCount).toBeGreaterThan(0);
  });

  it("rejects import without a url", async () => {
    const res = await request(app).post("/api/analyze/github").set(auth()).send({});
    expect(res.status).toBe(400);
  });
});
