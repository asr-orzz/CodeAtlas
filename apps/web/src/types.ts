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

// --- Boards (manually edited diagrams) ---

export interface BoardNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: {
    properties?: Array<{ name: string; type?: string; visibility?: string }>;
    methods?: Array<{ name: string; returnType?: string; visibility?: string }>;
    group?: string;
    [key: string]: unknown;
  };
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
}

export interface Board {
  id: string;
  projectId: string;
  name: string;
  nodes: BoardNode[];
  edges: BoardEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface BoardSummary {
  id: string;
  projectId: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
}

// --- AI assistant ---

export interface Smell {
  id: string;
  kind: "cycle" | "layering" | "god-object" | "isolated";
  severity: "info" | "warning" | "error";
  title: string;
  detail: string;
  nodes: string[];
}

export interface NodeRef {
  id: string;
  name: string;
  kind: string;
}

export type CanvasAction =
  | { type: "focusNode"; nodeId: string }
  | { type: "showDiagram"; kind: "class" | "component" | "dependency" | "call" }
  | { type: "generateSequence"; entryId: string }
  | { type: "highlightNodes"; nodeIds: string[] };

export interface AiAnswer {
  answer: string;
  source: "provider" | "deterministic";
  matches?: NodeRef[];
  action?: CanvasAction;
}

export type GraphViewKind = "dependency" | "call";

export interface GraphView {
  view: GraphViewKind;
  nodes: Array<{ id: string; name: string; kind: string; filePath?: string; group?: string }>;
  edges: Array<{ id: string; source: string; target: string; kind: string; label?: string }>;
}
