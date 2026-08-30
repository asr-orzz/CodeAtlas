import type { EdgeKind } from "./ir.js";

/**
 * Edge kinds that make up the "who depends on whom" dependency graph.
 * A dependency exists when one entity structurally needs another.
 */
export const DEPENDENCY_EDGE_KINDS: EdgeKind[] = [
  "dependency",
  "uses",
  "creates",
  "inheritance",
  "implements",
];

/** Edge kinds that make up the "who calls whom" call graph. */
export const CALL_EDGE_KINDS: EdgeKind[] = ["calls"];
