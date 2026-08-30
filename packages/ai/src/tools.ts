import {
  CALL_EDGE_KINDS,
  DEPENDENCY_EDGE_KINDS,
  type ArchitectureGraph,
  type IRNode,
} from "@archx/core";
import {
  DirectedGraph,
  shortestPath,
  transitiveDependencies,
  transitiveDependents,
} from "@archx/graph";

export interface NodeRef {
  id: string;
  name: string;
  kind: string;
}

export interface PathResult {
  found: boolean;
  nodes: NodeRef[];
}

/**
 * Deterministic, fact-based graph queries the assistant (or the API) can run
 * against an Architecture IR. This is the "tool layer" an agent calls — no
 * inference, just the graph engine applied to the dependency and call graphs.
 */
export class GraphTools {
  private readonly nodeById: Map<string, IRNode>;
  private readonly dep: DirectedGraph;
  private readonly call: DirectedGraph;

  constructor(private readonly ir: ArchitectureGraph) {
    this.nodeById = new Map(ir.nodes.map((n) => [n.id, n]));
    this.dep = DirectedGraph.fromArchitecture(ir, DEPENDENCY_EDGE_KINDS);
    this.call = DirectedGraph.fromArchitecture(ir, CALL_EDGE_KINDS);
  }

  private ref(id: string): NodeRef {
    const node = this.nodeById.get(id);
    return { id, name: node?.name ?? id, kind: node?.kind ?? "unknown" };
  }

  private refs(ids: Iterable<string>): NodeRef[] {
    return [...ids]
      .map((id) => this.ref(id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  has(id: string): boolean {
    return this.nodeById.has(id);
  }

  getNode(id: string): NodeRef | undefined {
    return this.nodeById.has(id) ? this.ref(id) : undefined;
  }

  /** Case-insensitive search over node names, best matches first. */
  search(query: string, limit = 10): NodeRef[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = this.ir.nodes
      .map((n) => {
        const name = n.name.toLowerCase();
        let score = -1;
        if (name === q) score = 0;
        else if (name.startsWith(q)) score = 1;
        else if (name.includes(q)) score = 2;
        return { n, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score || a.n.name.localeCompare(b.n.name))
      .slice(0, limit);
    return scored.map((x) => this.ref(x.n.id));
  }

  /** Direct or transitive dependencies (what `id` depends on). */
  dependencies(id: string, transitive = false): NodeRef[] {
    if (!this.has(id)) return [];
    const ids = transitive
      ? transitiveDependencies(this.dep, id)
      : new Set(this.dep.successors(id));
    return this.refs(ids);
  }

  /** Direct or transitive dependents (what depends on `id`). */
  dependents(id: string, transitive = false): NodeRef[] {
    if (!this.has(id)) return [];
    const ids = transitive
      ? transitiveDependents(this.dep, id)
      : new Set(this.dep.predecessors(id));
    return this.refs(ids);
  }

  /** Things `id` calls (call-graph successors). */
  callees(id: string): NodeRef[] {
    if (!this.has(id)) return [];
    return this.refs(this.call.successors(id));
  }

  /** Things that call `id` (call-graph predecessors). */
  callers(id: string): NodeRef[] {
    if (!this.has(id)) return [];
    return this.refs(this.call.predecessors(id));
  }

  /** Shortest dependency path between two nodes. */
  path(fromId: string, toId: string): PathResult {
    const path = shortestPath(this.dep, fromId, toId);
    if (!path) return { found: false, nodes: [] };
    return { found: true, nodes: path.map((id) => this.ref(id)) };
  }

  /**
   * The local neighborhood of a node up to `depth` hops in either direction —
   * useful for focusing the canvas on one area of the graph.
   */
  neighborhood(id: string, depth = 1): string[] {
    if (!this.has(id)) return [];
    const result = new Set<string>([id]);
    let frontier = new Set<string>([id]);
    for (let d = 0; d < depth; d++) {
      const next = new Set<string>();
      for (const n of frontier) {
        for (const s of this.dep.successors(n)) if (!result.has(s)) next.add(s);
        for (const p of this.dep.predecessors(n)) if (!result.has(p)) next.add(p);
      }
      for (const n of next) result.add(n);
      frontier = next;
      if (frontier.size === 0) break;
    }
    return [...result];
  }
}
