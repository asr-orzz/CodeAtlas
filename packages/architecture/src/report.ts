import {
  DEPENDENCY_EDGE_KINDS,
  type ArchitectureGraph,
  type EdgeKind,
  type NodeKind,
} from "@archx/core";
import { DirectedGraph, findCycles, topologicalSort } from "@archx/graph";

export interface RankedNode {
  id: string;
  name: string;
  count: number;
}

export interface DetectedCycle {
  /** Node ids participating in the cycle. */
  nodes: string[];
  /** Their display names, for convenience. */
  names: string[];
}

export interface ArchitectureReport {
  nodeCount: number;
  edgeCount: number;
  nodesByKind: Partial<Record<NodeKind, number>>;
  edgesByKind: Partial<Record<EdgeKind, number>>;
  /** Dependency cycles (empty means the dependency graph is acyclic). */
  cycles: DetectedCycle[];
  /** True when the dependency graph has no cycles (cleanly layerable). */
  isLayered: boolean;
  /** Nodes most depended upon (highest dependency fan-in). */
  mostDependedUpon: RankedNode[];
  /** Nodes with the most dependencies (highest dependency fan-out). */
  mostDependencies: RankedNode[];
}

/** Compute structural metrics over an Architecture IR using the graph engine. */
export function computeArchitectureReport(
  graph: ArchitectureGraph,
  topN = 5,
): ArchitectureReport {
  const nameById = new Map(graph.nodes.map((n) => [n.id, n.name]));

  const nodesByKind: Partial<Record<NodeKind, number>> = {};
  for (const node of graph.nodes) {
    nodesByKind[node.kind] = (nodesByKind[node.kind] ?? 0) + 1;
  }
  const edgesByKind: Partial<Record<EdgeKind, number>> = {};
  for (const edge of graph.edges) {
    edgesByKind[edge.kind] = (edgesByKind[edge.kind] ?? 0) + 1;
  }

  const dep = DirectedGraph.fromArchitecture(graph, DEPENDENCY_EDGE_KINDS);

  const cycles: DetectedCycle[] = findCycles(dep).map((nodes) => ({
    nodes,
    names: nodes.map((id) => nameById.get(id) ?? id),
  }));

  const ranked = (degree: (id: string) => number): RankedNode[] =>
    dep
      .nodes()
      .map((id) => ({ id, name: nameById.get(id) ?? id, count: degree(id) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, topN);

  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    nodesByKind,
    edgesByKind,
    cycles,
    isLayered: !topologicalSort(dep).hasCycle,
    mostDependedUpon: ranked((id) => dep.inDegree(id)),
    mostDependencies: ranked((id) => dep.outDegree(id)),
  };
}
