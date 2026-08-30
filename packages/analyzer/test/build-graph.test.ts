import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ArchitectureGraph, EdgeKind } from "@archx/core";
import { analyzeProject, buildArchitecture } from "@archx/analyzer";

const fixtureRoot = fileURLToPath(new URL("./fixtures/sample", import.meta.url));

function build(): ArchitectureGraph {
  return buildArchitecture(analyzeProject(fixtureRoot));
}

const graph = build();

function id(name: string): string {
  const node = graph.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`no node named ${name}`);
  return node.id;
}

function hasEdge(sourceName: string, targetName: string, kind: EdgeKind): boolean {
  const s = id(sourceName);
  const t = id(targetName);
  return graph.edges.some((e) => e.source === s && e.target === t && e.kind === kind);
}

describe("buildArchitecture", () => {
  it("creates a node per class and interface", () => {
    const byKind = new Map<string, number>();
    for (const n of graph.nodes) byKind.set(n.kind, (byKind.get(n.kind) ?? 0) + 1);
    expect(byKind.get("class")).toBe(4);
    expect(byKind.get("interface")).toBe(2); // Repository, User
  });

  it("carries class members onto the node", () => {
    const ctrl = graph.nodes.find((n) => n.name === "UserController")!;
    expect(ctrl.data?.properties?.some((p) => p.name === "service")).toBe(true);
    expect(ctrl.data?.methods?.some((m) => m.name === "show")).toBe(true);
  });

  it("derives implements edges", () => {
    expect(hasEdge("UserRepository", "Repository", "implements")).toBe(true);
  });

  it("derives type-based dependency edges", () => {
    expect(hasEdge("UserController", "UserService", "dependency")).toBe(true);
    expect(hasEdge("UserRepository", "Database", "dependency")).toBe(true);
  });

  it("derives object-creation edges", () => {
    expect(hasEdge("UserService", "UserRepository", "creates")).toBe(true);
  });

  it("resolves this.<prop>.method() into call edges", () => {
    expect(hasEdge("UserController", "UserService", "calls")).toBe(true);
    expect(hasEdge("UserService", "UserRepository", "calls")).toBe(true);
    expect(hasEdge("UserRepository", "Database", "calls")).toBe(true);
  });

  it("labels call edges with the method name", () => {
    const s = id("UserController");
    const t = id("UserService");
    const call = graph.edges.find(
      (e) => e.source === s && e.target === t && e.kind === "calls",
    );
    expect(call?.label).toBe("getUser");
  });

  it("does not duplicate structural edges as plain dependencies", () => {
    // UserRepository -> Repository is `implements`, so there must be no
    // separate `dependency` edge between the same pair.
    expect(hasEdge("UserRepository", "Repository", "dependency")).toBe(false);
  });
});
