import { describe, expect, it } from "vitest";
import { emptyGraph, edgeId, type ArchitectureGraph } from "@archx/core";
import { DirectedGraph } from "@archx/graph";

function sampleIR(): ArchitectureGraph {
  const g = emptyGraph();
  g.nodes.push(
    { id: "ctrl", kind: "class", name: "UserController" },
    { id: "svc", kind: "class", name: "UserService" },
    { id: "repo", kind: "class", name: "UserRepository" },
  );
  g.edges.push(
    { id: edgeId("ctrl", "svc", "calls"), source: "ctrl", target: "svc", kind: "calls" },
    { id: edgeId("svc", "repo", "calls"), source: "svc", target: "repo", kind: "calls" },
    { id: edgeId("ctrl", "svc", "dependency"), source: "ctrl", target: "svc", kind: "dependency" },
  );
  return g;
}

describe("DirectedGraph.fromArchitecture", () => {
  it("includes every edge kind by default", () => {
    const g = DirectedGraph.fromArchitecture(sampleIR());
    expect(g.nodeCount()).toBe(3);
    expect(g.hasEdge("ctrl", "svc")).toBe(true);
    expect(g.hasEdge("svc", "repo")).toBe(true);
  });

  it("filters by edge kind whitelist", () => {
    const g = DirectedGraph.fromArchitecture(sampleIR(), ["dependency"]);
    expect(g.hasEdge("ctrl", "svc")).toBe(true);
    expect(g.hasEdge("svc", "repo")).toBe(false);
  });
});
