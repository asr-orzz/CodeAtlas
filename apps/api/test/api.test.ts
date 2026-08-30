import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ProjectStore } from "../src/store.js";

// The analyzer fixture doubles as a small realistic project to analyze.
const fixtureDir = fileURLToPath(
  new URL("../../../packages/analyzer/test/fixtures/sample", import.meta.url),
);

const app = createApp(new ProjectStore(mkdtempSync(path.join(tmpdir(), "archx-"))));

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

  it("returns 404 for unknown projects", async () => {
    const res = await request(app).get("/api/projects/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("rejects analyze without a path", async () => {
    const res = await request(app).post("/api/analyze").send({});
    expect(res.status).toBe(400);
  });
});

describe("GitHub import route", () => {
  const ghApp = createApp(
    new ProjectStore(mkdtempSync(path.join(tmpdir(), "archx-gh-route-"))),
    {
      cloner: () => ({
        dir: fixtureDir,
        commit: "deadbeef",
        branch: "main",
        cleanup: () => {},
      }),
    },
  );

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
