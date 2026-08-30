import { describe, expect, it } from "vitest";
import {
  DirectedGraph,
  bfs,
  dfs,
  findCycles,
  hasCycle,
  shortestPath,
  stronglyConnectedComponents,
  topologicalSort,
  transitiveDependencies,
  transitiveDependents,
  weaklyConnectedComponents,
} from "@archx/graph";

/** Build a graph from a list of "a->b" edge strings. */
function graphOf(edges: string[]): DirectedGraph {
  const g = new DirectedGraph();
  for (const e of edges) {
    const [s, t] = e.split("->");
    g.addEdge(s!.trim(), t!.trim());
  }
  return g;
}

describe("DirectedGraph", () => {
  it("tracks successors, predecessors and degrees", () => {
    const g = graphOf(["a->b", "a->c", "b->c"]);
    expect(g.successors("a").sort()).toEqual(["b", "c"]);
    expect(g.predecessors("c").sort()).toEqual(["a", "b"]);
    expect(g.outDegree("a")).toBe(2);
    expect(g.inDegree("c")).toBe(2);
    expect(g.hasEdge("a", "b")).toBe(true);
    expect(g.hasEdge("c", "a")).toBe(false);
  });

  it("collapses parallel edges", () => {
    const g = new DirectedGraph();
    g.addEdge("a", "b");
    g.addEdge("a", "b");
    expect(g.outDegree("a")).toBe(1);
  });

  it("reverses direction", () => {
    const r = graphOf(["a->b", "b->c"]).reversed();
    expect(r.successors("b")).toEqual(["a"]);
    expect(r.successors("c")).toEqual(["b"]);
  });
});

describe("traversal", () => {
  const g = graphOf(["a->b", "a->c", "b->d", "c->d"]);

  it("bfs visits by distance", () => {
    expect(bfs(g, "a")).toEqual(["a", "b", "c", "d"]);
  });

  it("dfs visits depth-first", () => {
    expect(dfs(g, "a")).toEqual(["a", "b", "d", "c"]);
  });

  it("returns empty for unknown start", () => {
    expect(bfs(g, "zzz")).toEqual([]);
  });
});

describe("shortestPath", () => {
  const g = graphOf(["a->b", "b->c", "a->x", "x->c", "c->d"]);

  it("finds the fewest-edges path", () => {
    expect(shortestPath(g, "a", "d")).toEqual(["a", "b", "c", "d"]);
  });

  it("handles same node", () => {
    expect(shortestPath(g, "a", "a")).toEqual(["a"]);
  });

  it("returns null when unreachable", () => {
    expect(shortestPath(g, "d", "a")).toBeNull();
  });
});

describe("transitive relations", () => {
  const g = graphOf(["a->b", "b->c", "c->d", "e->b"]);

  it("computes transitive dependencies", () => {
    expect([...transitiveDependencies(g, "a")].sort()).toEqual(["b", "c", "d"]);
  });

  it("computes transitive dependents", () => {
    expect([...transitiveDependents(g, "c")].sort()).toEqual(["a", "b", "e"]);
  });
});

describe("topologicalSort", () => {
  it("orders a DAG so dependencies come first", () => {
    const g = graphOf(["a->b", "a->c", "b->d", "c->d"]);
    const { order, hasCycle: cyclic } = topologicalSort(g);
    expect(cyclic).toBe(false);
    const pos = new Map(order.map((n, i) => [n, i]));
    expect(pos.get("a")!).toBeLessThan(pos.get("b")!);
    expect(pos.get("b")!).toBeLessThan(pos.get("d")!);
    expect(order).toHaveLength(4);
  });

  it("detects a cycle", () => {
    const g = graphOf(["a->b", "b->c", "c->a"]);
    expect(topologicalSort(g).hasCycle).toBe(true);
    expect(hasCycle(g)).toBe(true);
  });
});

describe("strongly connected components & cycles", () => {
  it("groups a 3-node cycle into one component", () => {
    const g = graphOf(["a->b", "b->c", "c->a", "c->d"]);
    const sccs = stronglyConnectedComponents(g).map((c) => c.slice().sort());
    expect(sccs).toContainEqual(["a", "b", "c"]);
    expect(sccs).toContainEqual(["d"]);
  });

  it("findCycles returns only cyclic groups", () => {
    const g = graphOf(["a->b", "b->c", "c->a", "x->y"]);
    const cycles = findCycles(g).map((c) => c.slice().sort());
    expect(cycles).toEqual([["a", "b", "c"]]);
  });

  it("detects self-loops as cycles", () => {
    const g = graphOf(["a->a", "a->b"]);
    expect(findCycles(g)).toEqual([["a"]]);
  });

  it("reports no cycles for a DAG", () => {
    const g = graphOf(["a->b", "b->c"]);
    expect(findCycles(g)).toEqual([]);
  });
});

describe("weaklyConnectedComponents", () => {
  it("groups nodes ignoring direction", () => {
    const g = graphOf(["a->b", "c->b", "x->y"]);
    const comps = weaklyConnectedComponents(g)
      .map((c) => c.slice().sort())
      .sort((p, q) => p[0]!.localeCompare(q[0]!));
    expect(comps).toEqual([
      ["a", "b", "c"],
      ["x", "y"],
    ]);
  });
});
