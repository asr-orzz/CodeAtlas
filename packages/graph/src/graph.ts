import type { ArchitectureGraph, EdgeKind } from "@archx/core";

/**
 * A minimal, dependency-free directed graph over string node ids.
 *
 * Parallel edges are collapsed (an edge either exists or it does not), which is
 * exactly what the graph algorithms below need. Edge payloads / kinds live in
 * the Architecture IR, not here.
 */
export class DirectedGraph {
  private readonly out = new Map<string, Set<string>>();
  private readonly in = new Map<string, Set<string>>();

  /** Add a node. No-op if it already exists. */
  addNode(id: string): void {
    if (!this.out.has(id)) this.out.set(id, new Set());
    if (!this.in.has(id)) this.in.set(id, new Set());
  }

  /** Add a directed edge source -> target, creating endpoints as needed. */
  addEdge(source: string, target: string): void {
    this.addNode(source);
    this.addNode(target);
    this.out.get(source)!.add(target);
    this.in.get(target)!.add(source);
  }

  hasNode(id: string): boolean {
    return this.out.has(id);
  }

  hasEdge(source: string, target: string): boolean {
    return this.out.get(source)?.has(target) ?? false;
  }

  /** All node ids, in insertion order. */
  nodes(): string[] {
    return [...this.out.keys()];
  }

  nodeCount(): number {
    return this.out.size;
  }

  /** Nodes that `id` points to. */
  successors(id: string): string[] {
    return [...(this.out.get(id) ?? [])];
  }

  /** Nodes that point to `id`. */
  predecessors(id: string): string[] {
    return [...(this.in.get(id) ?? [])];
  }

  outDegree(id: string): number {
    return this.out.get(id)?.size ?? 0;
  }

  inDegree(id: string): number {
    return this.in.get(id)?.size ?? 0;
  }

  /** Return a new graph with every edge direction flipped. */
  reversed(): DirectedGraph {
    const g = new DirectedGraph();
    for (const n of this.nodes()) g.addNode(n);
    for (const [source, targets] of this.out) {
      for (const target of targets) g.addEdge(target, source);
    }
    return g;
  }

  /**
   * Build a directed graph from an Architecture IR.
   *
   * @param graph      the Architecture IR
   * @param edgeKinds  optional whitelist of edge kinds to include (default: all)
   */
  static fromArchitecture(
    graph: ArchitectureGraph,
    edgeKinds?: ReadonlySet<EdgeKind> | EdgeKind[],
  ): DirectedGraph {
    const allowed =
      edgeKinds === undefined
        ? undefined
        : edgeKinds instanceof Set
          ? edgeKinds
          : new Set<EdgeKind>(edgeKinds);

    const g = new DirectedGraph();
    for (const node of graph.nodes) g.addNode(node.id);
    for (const edge of graph.edges) {
      if (allowed && !allowed.has(edge.kind)) continue;
      g.addEdge(edge.source, edge.target);
    }
    return g;
  }
}
