import type { ArchitectureGraph } from "@archx/core";
import type { ArchitectureReport } from "@archx/architecture";

export type { ArchitectureGraph, ArchitectureReport };

export interface ProjectSummary {
  id: string;
  name: string;
  source: string;
  createdAt: string;
  nodeCount: number;
  edgeCount: number;
  cycleCount: number;
}

export interface ImportResult {
  id: string;
  name: string;
  source: string;
  createdAt: string;
  meta?: {
    owner?: string;
    repository?: string;
    branch?: string;
    commit?: string;
  };
  report: ArchitectureReport;
}

export interface ProjectDetail {
  id: string;
  name: string;
  source: string;
  createdAt: string;
  ir: ArchitectureGraph;
  report: ArchitectureReport;
}

// --- Diagram model (mirrors @archx/diagram so the frontend stays decoupled) ---

export type DiagramKind =
  | "class"
  | "component"
  | "sequence"
  | "dependency"
  | "call";

export interface Point {
  x: number;
  y: number;
}

export interface DiagramNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: {
    properties?: Array<{ name: string; type?: string; visibility?: string }>;
    methods?: Array<{
      name: string;
      returnType?: string;
      visibility?: string;
      parameters?: Array<{ name: string; type?: string }>;
    }>;
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
  type: string;
  label?: string;
  order?: number;
  points?: Point[];
}

export interface DiagramModel {
  kind: DiagramKind;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  width: number;
  height: number;
  notes?: string[];
}

export type GraphViewKind = "dependency" | "call";

export interface GraphView {
  view: GraphViewKind;
  nodes: Array<{ id: string; name: string; kind: string; filePath?: string; group?: string }>;
  edges: Array<{ id: string; source: string; target: string; kind: string; label?: string }>;
}
