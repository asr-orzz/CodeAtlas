import { describe, expect, it } from "vitest";
import {
  emptyGraph,
  type ArchitectureGraph,
  type EdgeKind,
  type IRNode,
} from "@archx/core";
import {
  generateClassDiagram,
  generateComponentDiagram,
  generateSequenceDiagram,
} from "@archx/diagram";

function cls(id: string, name: string, extra: Partial<IRNode["data"]> = {}): IRNode {
  return { id, kind: "class", name, filePath: `${name}.ts`, data: { ...extra } };
}

function sampleIR(): ArchitectureGraph {
  const g = emptyGraph();
  g.nodes.push(
    cls("ctrl", "UserController", {
      properties: [{ name: "service", type: "UserService" }],
      methods: [{ name: "show", parameters: [{ name: "id", type: "string" }], returnType: "void" }],
    }),
    cls("svc", "UserService"),
    cls("repo", "UserRepository"),
    cls("db", "Database"),
    { id: "iface", kind: "interface", name: "Repository", filePath: "Repository.ts" },
  );
  const e = (source: string, target: string, kind: EdgeKind, label?: string) => ({
    id: `${kind}:${source}->${target}:${label ?? ""}`,
    source,
    target,
    kind,
    label,
  });
  g.edges.push(
    e("ctrl", "svc", "dependency"),
    e("ctrl", "svc", "calls", "getUser"),
    e("svc", "repo", "dependency"),
    e("svc", "repo", "calls", "findById"),
    e("repo", "db", "dependency"),
    e("repo", "db", "calls", "query"),
    e("repo", "iface", "implements"),
  );
  return g;
}

describe("generateClassDiagram", () => {
  const diagram = generateClassDiagram(sampleIR());

  it("lays out every class/interface node with a position and size", () => {
    expect(diagram.nodes).toHaveLength(5);
    for (const n of diagram.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.width).toBeGreaterThan(0);
      expect(n.height).toBeGreaterThan(0);
    }
  });

  it("includes structural edges but not calls", () => {
    expect(diagram.edges.some((e) => e.type === "implements")).toBe(true);
    expect(diagram.edges.some((e) => e.type === "dependency")).toBe(true);
    expect(diagram.edges.some((e) => e.type === "calls")).toBe(false);
    expect(diagram.edges.some((e) => e.type === "message")).toBe(false);
  });
});

describe("generateComponentDiagram", () => {
  const diagram = generateComponentDiagram(sampleIR());

  it("produces positioned component nodes", () => {
    expect(diagram.nodes.length).toBeGreaterThan(0);
    expect(diagram.nodes.every((n) => n.type === "component")).toBe(true);
    expect(diagram.nodes.every((n) => Number.isFinite(n.x))).toBe(true);
  });
});

describe("generateSequenceDiagram", () => {
  it("traces an ordered message flow from the controller", () => {
    const diagram = generateSequenceDiagram(sampleIR());
    const participantNames = diagram.nodes.map((n) => n.label);
    expect(participantNames).toEqual([
      "UserController",
      "UserService",
      "UserRepository",
      "Database",
    ]);

    const labels = diagram.edges
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((e) => e.label);
    expect(labels).toEqual(["getUser", "findById", "query"]);

    for (const e of diagram.edges) {
      expect(e.type).toBe("message");
      expect(e.points).toHaveLength(2);
    }
  });

  it("returns a note when there are no calls", () => {
    const g = emptyGraph();
    g.nodes.push(cls("a", "Alone"));
    const diagram = generateSequenceDiagram(g);
    expect(diagram.nodes).toHaveLength(0);
    expect(diagram.notes?.length).toBeGreaterThan(0);
  });
});
