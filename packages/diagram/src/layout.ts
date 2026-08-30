import dagre from "dagre";
import type { IRNode } from "@archx/core";
import type { DiagramEdge, DiagramNode, Point } from "./model.js";

export interface LayoutInput {
  nodes: Array<Omit<DiagramNode, "x" | "y">>;
  edges: Array<Omit<DiagramEdge, "points">>;
}

export interface LayoutOptions {
  rankdir?: "TB" | "LR" | "BT" | "RL";
  nodesep?: number;
  ranksep?: number;
}

export interface LayoutResult {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  width: number;
  height: number;
}

/**
 * Run a hierarchical dagre layout over pre-measured nodes. dagre returns node
 * centers; we convert them to top-left coordinates for rendering.
 */
export function runLayout(input: LayoutInput, options: LayoutOptions = {}): LayoutResult {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({
    rankdir: options.rankdir ?? "TB",
    nodesep: options.nodesep ?? 60,
    ranksep: options.ranksep ?? 80,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of input.nodes) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const edge of input.edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target, {}, edge.id);
    }
  }

  dagre.layout(g);

  const nodes: DiagramNode[] = input.nodes.map((node) => {
    const laid = g.node(node.id);
    const x = laid ? laid.x - node.width / 2 : 0;
    const y = laid ? laid.y - node.height / 2 : 0;
    return { ...node, x, y };
  });

  const edges: DiagramEdge[] = input.edges.map((edge) => {
    let points: Point[] | undefined;
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      const laid = g.edge({ v: edge.source, w: edge.target, name: edge.id });
      if (laid?.points) points = laid.points.map((p) => ({ x: p.x, y: p.y }));
    }
    return points ? { ...edge, points } : { ...edge };
  });

  const graphInfo = g.graph();
  return {
    nodes,
    edges,
    width: graphInfo.width ?? 0,
    height: graphInfo.height ?? 0,
  };
}

const CHAR_WIDTH = 7.2;
const LINE_HEIGHT = 18;
const HEADER_HEIGHT = 28;
const V_PADDING = 12;
const MIN_WIDTH = 160;
const MAX_WIDTH = 340;

function methodSignature(name: string, params: { name: string; type?: string }[], ret?: string): string {
  const args = params.map((p) => (p.type ? `${p.name}: ${p.type}` : p.name)).join(", ");
  return `${name}(${args})${ret ? `: ${ret}` : ""}`;
}

/** Measure a class/interface/enum node from its members. */
export function measureClassNode(node: IRNode): { width: number; height: number } {
  const props = node.data?.properties ?? [];
  const methods = node.data?.methods ?? [];

  const lines: string[] = [node.name];
  for (const p of props) lines.push(p.type ? `${p.name}: ${p.type}` : p.name);
  for (const m of methods)
    lines.push(methodSignature(m.name, m.parameters ?? [], m.returnType));

  const longest = lines.reduce((max, l) => Math.max(max, l.length), 0);
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(longest * CHAR_WIDTH) + 24));

  const bodyLines = props.length + methods.length;
  const dividers = (props.length > 0 ? 1 : 0) + (methods.length > 0 ? 1 : 0);
  const height =
    HEADER_HEIGHT + V_PADDING + bodyLines * LINE_HEIGHT + dividers * 6 + 8;

  return { width, height: Math.max(HEADER_HEIGHT + 20, height) };
}
