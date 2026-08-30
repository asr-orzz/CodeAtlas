/**
 * Architecture IR — the single fact-based representation of a codebase.
 *
 * Everything downstream (dependency graph, call graph, UML diagrams, the
 * interactive canvas and the AI assistant) is derived from this structure.
 * The IR itself is produced by deterministic static analysis, never by an LLM.
 */

/** A precise location inside a source file. */
export interface SourceLocation {
  file: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
}

/** Kinds of nodes the IR can hold, from fine-grained code to coarse architecture. */
export type NodeKind =
  | "file"
  | "module"
  | "package"
  | "class"
  | "interface"
  | "enum"
  | "function"
  | "method"
  | "service"
  | "component"
  | "database"
  | "api"
  | "actor"
  | "external";

/** Kinds of relationships between nodes. */
export type EdgeKind =
  | "imports"
  | "calls"
  | "inheritance"
  | "implements"
  | "composition"
  | "aggregation"
  | "association"
  | "dependency"
  | "creates"
  | "uses"
  | "contains";

export type Visibility = "public" | "private" | "protected";

/** A property/field on a class or interface. */
export interface PropertyInfo {
  name: string;
  type?: string;
  visibility?: Visibility;
  isStatic?: boolean;
  isReadonly?: boolean;
}

/** A method/function member on a class or interface. */
export interface MethodInfo {
  name: string;
  returnType?: string;
  visibility?: Visibility;
  isStatic?: boolean;
  isAsync?: boolean;
  parameters?: Array<{ name: string; type?: string }>;
}

/** Extra structured payload carried by a node. */
export interface NodeData {
  properties?: PropertyInfo[];
  methods?: MethodInfo[];
  language?: string;
  /** Id of the node that visually/logically contains this one (e.g. its file/module). */
  parent?: string;
  /** Free-form grouping key used by aggregation (e.g. "controllers"). */
  group?: string;
  /** Arbitrary analyzer metadata. */
  meta?: Record<string, unknown>;
}

/** A single entity in the architecture graph. */
export interface IRNode {
  id: string;
  kind: NodeKind;
  name: string;
  filePath?: string;
  location?: SourceLocation;
  data?: NodeData;
}

/** A directed relationship between two entities. */
export interface IREdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label?: string;
  location?: SourceLocation;
  meta?: Record<string, unknown>;
}

/** Provenance and context for an analysis run. */
export interface ArchitectureMeta {
  repository?: string;
  owner?: string;
  branch?: string;
  commit?: string;
  rootPath?: string;
  language?: string;
  generatedAt?: string;
  /** Non-fatal issues encountered during analysis. */
  warnings?: string[];
}

/** The complete Architecture IR for a project at a point in time. */
export interface ArchitectureGraph {
  nodes: IRNode[];
  edges: IREdge[];
  meta: ArchitectureMeta;
}

/** Create an empty, well-formed architecture graph. */
export function emptyGraph(meta: ArchitectureMeta = {}): ArchitectureGraph {
  return {
    nodes: [],
    edges: [],
    meta: { generatedAt: new Date().toISOString(), warnings: [], ...meta },
  };
}

/** Deterministic id for an edge, so identical relations de-duplicate cleanly. */
export function edgeId(source: string, target: string, kind: EdgeKind): string {
  return `${kind}:${source}->${target}`;
}
