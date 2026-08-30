import {
  CALL_EDGE_KINDS,
  DEPENDENCY_EDGE_KINDS,
  type ArchitectureGraph,
  type EdgeKind,
} from "@archx/core";

export type GraphViewKind = "dependency" | "call";

export interface GraphViewNode {
  id: string;
  name: string;
  kind: string;
  filePath?: string;
  group?: string;
}

export interface GraphView {
  view: GraphViewKind;
  nodes: GraphViewNode[];
  edges: Array<{ id: string; source: string; target: string; kind: EdgeKind; label?: string }>;
}

/** Project the IR down to a single relationship view (dependency or call). */
export function graphView(ir: ArchitectureGraph, view: GraphViewKind): GraphView {
  const kinds = new Set<EdgeKind>(
    view === "call" ? CALL_EDGE_KINDS : DEPENDENCY_EDGE_KINDS,
  );
  return {
    view,
    nodes: ir.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      filePath: n.filePath,
      group: n.data?.group,
    })),
    edges: ir.edges
      .filter((e) => kinds.has(e.kind))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        kind: e.kind,
        label: e.label,
      })),
  };
}
