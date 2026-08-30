import type { EdgeKind, MethodInfo, NodeKind, PropertyInfo } from "@archx/core";

export type DiagramKind = "class" | "component" | "sequence";

/** The visual type of a diagram node. */
export type DiagramNodeType = NodeKind | "lifeline";

/** Edge kinds a diagram can render, plus the sequence-only "message". */
export type DiagramEdgeType = EdgeKind | "message";

export interface Point {
  x: number;
  y: number;
}

export interface DiagramNode {
  id: string;
  label: string;
  type: DiagramNodeType;
  /** Top-left position. */
  x: number;
  y: number;
  width: number;
  height: number;
  data?: {
    properties?: PropertyInfo[];
    methods?: MethodInfo[];
    filePath?: string;
    group?: string;
    memberCount?: number;
    meta?: Record<string, unknown>;
  };
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: DiagramEdgeType;
  label?: string;
  /** For sequence diagrams: 0-based vertical ordering of the message. */
  order?: number;
  /** Optional routed polyline (dagre for structural diagrams). */
  points?: Point[];
}

export interface DiagramModel {
  kind: DiagramKind;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  width: number;
  height: number;
  /** Non-fatal notes, e.g. "no entry point found for sequence diagram". */
  notes?: string[];
}

export function emptyDiagram(kind: DiagramKind, notes: string[] = []): DiagramModel {
  return { kind, nodes: [], edges: [], width: 0, height: 0, notes };
}
