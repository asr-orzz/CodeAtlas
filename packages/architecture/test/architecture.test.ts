import { describe, expect, it } from "vitest";
import {
  emptyGraph,
  type ArchitectureGraph,
  type EdgeKind,
  type IRNode,
  type NodeKind,
} from "@archx/core";
import {
  aggregateByRole,
  classifyRole,
  computeArchitectureReport,
  tagRoles,
} from "@archx/architecture";

function node(id: string, name: string, kind: NodeKind, filePath?: string): IRNode {
  return { id, kind, name, filePath };
}

function layeredGraph(): ArchitectureGraph {
  const g = emptyGraph();
  g.nodes.push(
    node("a", "UserController", "class", "src/controllers/UserController.ts"),
    node("b", "UserService", "class", "src/services/UserService.ts"),
    node("c", "UserRepository", "class", "src/repositories/UserRepository.ts"),
    node("d", "Database", "class", "src/db/Database.ts"),
    node("e", "User", "interface", "src/models/User.ts"),
  );
  const edge = (source: string, target: string, kind: EdgeKind) => ({
    id: `${kind}:${source}->${target}`,
    source,
    target,
    kind,
  });
  g.edges.push(
    edge("a", "b", "dependency"),
    edge("a", "b", "calls"),
    edge("b", "c", "dependency"),
    edge("b", "c", "creates"),
    edge("c", "d", "dependency"),
    edge("c", "d", "calls"),
    edge("c", "e", "dependency"),
  );
  return g;
}

describe("classifyRole / tagRoles", () => {
  it("infers roles from names and paths", () => {
    const g = layeredGraph();
    const roleOf = (name: string) =>
      classifyRole(g.nodes.find((n) => n.name === name)!);
    expect(roleOf("UserController")).toBe("controller");
    expect(roleOf("UserService")).toBe("service");
    expect(roleOf("UserRepository")).toBe("repository");
    expect(roleOf("Database")).toBe("database");
    expect(roleOf("User")).toBe("model");
  });

  it("writes the role into data.group", () => {
    const tagged = tagRoles(layeredGraph());
    const ctrl = tagged.nodes.find((n) => n.name === "UserController")!;
    expect(ctrl.data?.group).toBe("controller");
  });
});

describe("aggregateByRole", () => {
  const agg = aggregateByRole(layeredGraph());

  it("produces one component node per role", () => {
    const names = agg.nodes.map((n) => n.name).sort();
    expect(names).toEqual([
      "Controllers",
      "Databases",
      "Models",
      "Repositories",
      "Services",
    ]);
    expect(agg.nodes.every((n) => n.kind === "component")).toBe(true);
  });

  it("lifts and weights cross-group edges", () => {
    const edge = agg.edges.find(
      (e) => e.source === "component:controller" && e.target === "component:service",
    );
    expect(edge).toBeDefined();
    expect(edge!.meta?.weight).toBe(2); // dependency + calls
    expect(edge!.kind).toBe("dependency");
  });

  it("does not create self edges within a group", () => {
    expect(agg.edges.every((e) => e.source !== e.target)).toBe(true);
  });
});

describe("computeArchitectureReport", () => {
  it("summarizes an acyclic architecture", () => {
    const report = computeArchitectureReport(layeredGraph());
    expect(report.nodeCount).toBe(5);
    expect(report.isLayered).toBe(true);
    expect(report.cycles).toHaveLength(0);
    expect(report.mostDependedUpon[0]).toBeDefined();
    expect(report.nodesByKind.class).toBe(4);
  });

  it("detects dependency cycles", () => {
    const g = emptyGraph();
    g.nodes.push(node("a", "A", "class"), node("b", "B", "class"), node("c", "C", "class"));
    const dep = (s: string, t: string) => ({
      id: `dependency:${s}->${t}`,
      source: s,
      target: t,
      kind: "dependency" as EdgeKind,
    });
    g.edges.push(dep("a", "b"), dep("b", "c"), dep("c", "a"));
    const report = computeArchitectureReport(g);
    expect(report.isLayered).toBe(false);
    expect(report.cycles).toHaveLength(1);
    expect(report.cycles[0]!.names.sort()).toEqual(["A", "B", "C"]);
  });
});
