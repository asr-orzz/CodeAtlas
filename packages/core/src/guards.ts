import type { EdgeKind, IREdge, IRNode, NodeKind } from "./ir.js";

/** Node kinds that represent runnable/definable code symbols. */
export const CODE_NODE_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>([
  "class",
  "interface",
  "enum",
  "function",
  "method",
]);

/** Node kinds that represent higher-level architecture concepts. */
export const ARCHITECTURE_NODE_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>([
  "service",
  "component",
  "database",
  "api",
  "actor",
  "external",
]);

/** Edge kinds that express a "type-level" relationship (used by class UML). */
export const STRUCTURAL_EDGE_KINDS: ReadonlySet<EdgeKind> = new Set<EdgeKind>([
  "inheritance",
  "implements",
  "composition",
  "aggregation",
  "association",
  "dependency",
]);

export function isCodeNode(node: IRNode): boolean {
  return CODE_NODE_KINDS.has(node.kind);
}

export function isArchitectureNode(node: IRNode): boolean {
  return ARCHITECTURE_NODE_KINDS.has(node.kind);
}

export function isStructuralEdge(edge: IREdge): boolean {
  return STRUCTURAL_EDGE_KINDS.has(edge.kind);
}
