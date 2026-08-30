import {
  emptyGraph,
  type ArchitectureGraph,
  type EdgeKind,
  type IRNode,
} from "@archx/core";
import { classifyRole, roleLabel } from "./roles.js";

/** Grouping decision for a node: which group it belongs to (or `null` to exclude it). */
export type GroupOf = (node: IRNode) => { key: string; name: string } | null;

export interface AggregateOptions {
  groupOf: GroupOf;
  /** Only lift edges of these kinds (default: all edge kinds). */
  edgeKinds?: EdgeKind[];
}

/**
 * Collapse a fine-grained graph into a component graph: nodes are groups, and
 * an edge exists between two groups if any member edge crosses between them.
 * Cross-group edges are counted (weight) and their kinds recorded.
 */
export function aggregate(
  graph: ArchitectureGraph,
  options: AggregateOptions,
): ArchitectureGraph {
  const allowedKinds = options.edgeKinds ? new Set(options.edgeKinds) : null;

  const nodeGroup = new Map<string, string>();
  const groups = new Map<string, { name: string; members: string[] }>();

  for (const node of graph.nodes) {
    const g = options.groupOf(node);
    if (!g) continue;
    nodeGroup.set(node.id, g.key);
    const bucket = groups.get(g.key);
    if (bucket) bucket.members.push(node.id);
    else groups.set(g.key, { name: g.name, members: [node.id] });
  }

  const out = emptyGraph({ ...graph.meta });
  for (const [key, bucket] of groups) {
    out.nodes.push({
      id: `component:${key}`,
      kind: "component",
      name: bucket.name,
      data: {
        meta: { memberIds: bucket.members, memberCount: bucket.members.length },
      },
    });
  }

  interface Agg {
    source: string;
    target: string;
    weight: number;
    kinds: Set<EdgeKind>;
  }
  const aggregated = new Map<string, Agg>();
  for (const edge of graph.edges) {
    if (allowedKinds && !allowedKinds.has(edge.kind)) continue;
    const sg = nodeGroup.get(edge.source);
    const tg = nodeGroup.get(edge.target);
    if (!sg || !tg || sg === tg) continue;
    const key = `${sg}\u0000${tg}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.weight += 1;
      existing.kinds.add(edge.kind);
    } else {
      aggregated.set(key, {
        source: sg,
        target: tg,
        weight: 1,
        kinds: new Set([edge.kind]),
      });
    }
  }

  for (const agg of aggregated.values()) {
    const source = `component:${agg.source}`;
    const target = `component:${agg.target}`;
    out.edges.push({
      id: `dependency:${source}->${target}`,
      source,
      target,
      kind: "dependency",
      label: String(agg.weight),
      meta: { weight: agg.weight, kinds: [...agg.kinds] },
    });
  }

  return out;
}

/** Aggregate code nodes by their inferred architectural role. */
export function aggregateByRole(graph: ArchitectureGraph): ArchitectureGraph {
  return aggregate(graph, {
    groupOf: (node) => {
      if (node.kind === "component") return null;
      const role = classifyRole(node);
      return { key: role, name: roleLabel(role) };
    },
  });
}

/**
 * Aggregate nodes by the first `depth` segments of their file path
 * (e.g. depth 1 groups by top-level folder).
 */
export function aggregateByDirectory(
  graph: ArchitectureGraph,
  depth = 1,
): ArchitectureGraph {
  return aggregate(graph, {
    groupOf: (node) => {
      if (node.kind === "component") return null;
      const filePath = node.filePath ?? "";
      const segments = filePath.split("/").filter(Boolean);
      const dir = segments.slice(0, Math.max(1, depth)).join("/");
      const key = segments.length > 1 ? dir : segments[0] ?? "root";
      const name = key.includes("/") ? key : key || "root";
      return { key, name };
    },
  });
}
