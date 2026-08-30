import { DEPENDENCY_EDGE_KINDS, type ArchitectureGraph } from "@archx/core";
import { DirectedGraph, findCycles } from "@archx/graph";
import { classifyRole, roleLabel, type ArchitectureRole } from "@archx/architecture";

export type SmellKind = "cycle" | "layering" | "god-object" | "isolated";
export type Severity = "info" | "warning" | "error";

export interface Smell {
  id: string;
  kind: SmellKind;
  severity: Severity;
  title: string;
  detail: string;
  /** Node ids involved, for highlighting on the canvas. */
  nodes: string[];
}

/**
 * Layer ranks used to reason about dependency direction. Lower numbers sit
 * closer to the entry point; a healthy layered app depends "downward" and never
 * skips more than one layer.
 */
const LAYER_RANK: Partial<Record<ArchitectureRole, number>> = {
  controller: 0,
  api: 0,
  service: 1,
  repository: 2,
  database: 3,
};

export interface SmellOptions {
  /** Fan-out at or above this flags a "god object" candidate. */
  godObjectFanOut?: number;
  /** Total degree (in + out) at or above this also flags a god object. */
  godObjectTotal?: number;
}

/** Detect common architectural smells deterministically from the IR. */
export function detectSmells(
  ir: ArchitectureGraph,
  options: SmellOptions = {},
): Smell[] {
  const fanOutLimit = options.godObjectFanOut ?? 8;
  const totalLimit = options.godObjectTotal ?? 14;

  const nameById = new Map(ir.nodes.map((n) => [n.id, n.name]));
  const roleById = new Map(ir.nodes.map((n) => [n.id, classifyRole(n)]));
  const dep = DirectedGraph.fromArchitecture(ir, DEPENDENCY_EDGE_KINDS);
  const smells: Smell[] = [];

  // 1. Circular dependencies.
  for (const cycle of findCycles(dep)) {
    const names = cycle.map((id) => nameById.get(id) ?? id);
    smells.push({
      id: `cycle:${cycle.join(">")}`,
      kind: "cycle",
      severity: "error",
      title: `Circular dependency (${cycle.length} modules)`,
      detail: `These modules form a dependency cycle: ${names.join(" → ")} → ${names[0]}. Cycles make the code hard to test, reuse and reason about; consider extracting a shared abstraction or inverting one dependency.`,
      nodes: cycle,
    });
  }

  // 2. Layering violations (upward or layer-skipping dependencies).
  for (const edge of ir.edges) {
    if (!DEPENDENCY_EDGE_KINDS.includes(edge.kind)) continue;
    const from = LAYER_RANK[roleById.get(edge.source) ?? "other"];
    const to = LAYER_RANK[roleById.get(edge.target) ?? "other"];
    if (from === undefined || to === undefined) continue;
    const sName = nameById.get(edge.source) ?? edge.source;
    const tName = nameById.get(edge.target) ?? edge.target;

    if (from > to) {
      smells.push({
        id: `layering:up:${edge.id}`,
        kind: "layering",
        severity: "warning",
        title: "Upward dependency",
        detail: `${sName} (${roleLabel(roleById.get(edge.source)!)}) depends on ${tName} (${roleLabel(roleById.get(edge.target)!)}), which sits in a higher layer. Lower layers should not depend on higher ones.`,
        nodes: [edge.source, edge.target],
      });
    } else if (to - from > 1) {
      smells.push({
        id: `layering:skip:${edge.id}`,
        kind: "layering",
        severity: "warning",
        title: "Layer-skipping dependency",
        detail: `${sName} depends directly on ${tName}, skipping the intermediate layer(s). Route this through the adjacent layer to preserve the architecture's boundaries.`,
        nodes: [edge.source, edge.target],
      });
    }
  }

  // 3. God objects (too many responsibilities / dependencies).
  for (const id of dep.nodes()) {
    const out = dep.outDegree(id);
    const total = out + dep.inDegree(id);
    if (out >= fanOutLimit || total >= totalLimit) {
      smells.push({
        id: `god:${id}`,
        kind: "god-object",
        severity: "info",
        title: "Possible god object",
        detail: `${nameById.get(id) ?? id} has an unusually high connectivity (out: ${out}, total: ${total}). It may be taking on too many responsibilities and could be split.`,
        nodes: [id],
      });
    }
  }

  return smells;
}
