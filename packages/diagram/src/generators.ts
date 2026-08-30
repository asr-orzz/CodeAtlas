import type { ArchitectureGraph, EdgeKind, IRNode } from "@archx/core";
import { aggregateByRole } from "@archx/architecture";
import { emptyDiagram, type DiagramEdge, type DiagramModel, type DiagramNode } from "./model.js";
import { measureClassNode, runLayout } from "./layout.js";

/** Edge kinds shown on a class diagram (structural relationships, not calls). */
export const CLASS_EDGE_KINDS: EdgeKind[] = [
  "inheritance",
  "implements",
  "dependency",
  "composition",
  "aggregation",
  "association",
  "creates",
  "uses",
];

const CLASS_NODE_KINDS = new Set(["class", "interface", "enum"]);

/** Automatically generate a laid-out class diagram from the Architecture IR. */
export function generateClassDiagram(ir: ArchitectureGraph): DiagramModel {
  const classNodes = ir.nodes.filter((n) => CLASS_NODE_KINDS.has(n.kind));
  if (classNodes.length === 0) {
    return emptyDiagram("class", ["No classes, interfaces or enums to display."]);
  }
  const nodeIds = new Set(classNodes.map((n) => n.id));

  const nodes: Array<Omit<DiagramNode, "x" | "y">> = classNodes.map((n: IRNode) => {
    const { width, height } = measureClassNode(n);
    return {
      id: n.id,
      label: n.name,
      type: n.kind,
      width,
      height,
      data: {
        properties: n.data?.properties,
        methods: n.data?.methods,
        filePath: n.filePath,
        group: n.data?.group,
      },
    };
  });

  const kinds = new Set(CLASS_EDGE_KINDS);
  const edges: Array<Omit<DiagramEdge, "points">> = ir.edges
    .filter((e) => kinds.has(e.kind) && nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.kind,
      label: e.label,
    }));

  const laid = runLayout({ nodes, edges }, { rankdir: "TB" });
  return { kind: "class", ...laid };
}

const COMPONENT_WIDTH = 180;
const COMPONENT_HEIGHT = 72;

/**
 * Automatically generate a component diagram by aggregating the IR into roles
 * and laying the resulting component graph out top-to-bottom.
 */
export function generateComponentDiagram(ir: ArchitectureGraph): DiagramModel {
  const aggregated = aggregateByRole(ir);
  if (aggregated.nodes.length === 0) {
    return emptyDiagram("component", ["Nothing to aggregate into components."]);
  }

  const nodes: Array<Omit<DiagramNode, "x" | "y">> = aggregated.nodes.map((n) => {
    const memberCount = Number(n.data?.meta?.["memberCount"] ?? 0);
    const width = Math.max(COMPONENT_WIDTH, n.name.length * 8 + 40);
    return {
      id: n.id,
      label: n.name,
      type: "component",
      width,
      height: COMPONENT_HEIGHT,
      data: { memberCount, meta: n.data?.meta },
    };
  });

  const edges: Array<Omit<DiagramEdge, "points">> = aggregated.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.kind,
    label: e.label,
  }));

  const laid = runLayout({ nodes, edges }, { rankdir: "TB", ranksep: 90 });
  return { kind: "component", ...laid };
}
