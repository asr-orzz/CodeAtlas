import {
  emptyGraph,
  type ArchitectureGraph,
  type ArchitectureMeta,
  type EdgeKind,
  type IREdge,
  type IRNode,
  type MethodInfo,
  type PropertyInfo,
} from "@archx/core";
import type {
  AnalyzedClass,
  AnalyzedFunction,
  AnalyzedInterface,
  AnalyzedMethod,
  SourceAnalysis,
  SymbolReference,
} from "./types.js";

const TOKEN_RE = /[A-Za-z_$][\w$]*/g;

/** Extract identifier tokens from a type annotation, e.g. "Promise<User>" -> [Promise, User]. */
function typeTokens(typeText: string | undefined): string[] {
  if (!typeText) return [];
  return typeText.match(TOKEN_RE) ?? [];
}

/**
 * A file-scoped symbol resolver. Resolution order: same-file declaration,
 * then named import, then a project-wide unique name.
 */
interface Resolver {
  resolve(fileRel: string, name: string): string | undefined;
}

function buildResolver(analysis: SourceAnalysis): {
  resolver: Resolver;
  knownIds: Set<string>;
} {
  const knownIds = new Set<string>();
  const byName = new Map<string, string[]>();
  const byFile = new Map<string, Map<string, string>>();

  const record = (fileRel: string, name: string, id: string): void => {
    knownIds.add(id);
    const list = byName.get(name);
    if (list) list.push(id);
    else byName.set(name, [id]);
    let fileMap = byFile.get(fileRel);
    if (!fileMap) {
      fileMap = new Map();
      byFile.set(fileRel, fileMap);
    }
    fileMap.set(name, id);
  };

  for (const c of analysis.classes) record(c.filePath, c.name, c.id);
  for (const i of analysis.interfaces) record(i.filePath, i.name, i.id);
  for (const e of analysis.enums) record(e.filePath, e.name, e.id);
  for (const f of analysis.functions) record(f.filePath, f.name, f.id);

  // Named imports -> resolved symbol ids.
  const byImport = new Map<string, Map<string, string>>();
  for (const file of analysis.files) {
    const map = new Map<string, string>();
    for (const imp of file.imports) {
      if (!imp.resolvedFilePath) continue;
      for (const named of imp.namedImports) {
        const targetId = `${imp.resolvedFilePath}#${named}`;
        if (knownIds.has(targetId)) map.set(named, targetId);
      }
    }
    if (map.size > 0) byImport.set(file.path, map);
  }

  const resolver: Resolver = {
    resolve(fileRel, name) {
      const same = byFile.get(fileRel)?.get(name);
      if (same) return same;
      const imported = byImport.get(fileRel)?.get(name);
      if (imported) return imported;
      const global = byName.get(name);
      if (global && global.length === 1) return global[0];
      return undefined;
    },
  };

  return { resolver, knownIds };
}

function toPropertyInfo(cls: AnalyzedClass | AnalyzedInterface): PropertyInfo[] {
  return cls.properties.map((p) => ({
    name: p.name,
    type: p.type,
    visibility: p.visibility,
    isStatic: p.isStatic,
    isReadonly: p.isReadonly,
  }));
}

function toMethodInfo(methods: AnalyzedMethod[]): MethodInfo[] {
  return methods.map((m) => ({
    name: m.name,
    returnType: m.returnType,
    visibility: m.visibility,
    isStatic: m.isStatic,
    isAsync: m.isAsync,
    parameters: m.parameters.map((p) => ({ name: p.name, type: p.type })),
  }));
}

/**
 * Build the code-level Architecture IR from a static analysis.
 *
 * Nodes are classes, interfaces, enums and functions. Edges are derived purely
 * from facts in the analysis: inheritance, implements, type-based dependencies,
 * object creation and resolved method calls.
 */
export function buildArchitecture(
  analysis: SourceAnalysis,
  meta: ArchitectureMeta = {},
): ArchitectureGraph {
  const graph = emptyGraph({
    rootPath: analysis.rootPath,
    language: "typescript",
    warnings: [...analysis.warnings],
    ...meta,
  });

  const { resolver } = buildResolver(analysis);

  // --- Nodes ---
  for (const c of analysis.classes) {
    graph.nodes.push({
      id: c.id,
      kind: "class",
      name: c.name,
      filePath: c.filePath,
      location: c.location,
      data: { properties: toPropertyInfo(c), methods: toMethodInfo(c.methods) },
    });
  }
  for (const i of analysis.interfaces) {
    graph.nodes.push({
      id: i.id,
      kind: "interface",
      name: i.name,
      filePath: i.filePath,
      location: i.location,
      data: { properties: toPropertyInfo(i), methods: toMethodInfo(i.methods) },
    });
  }
  for (const e of analysis.enums) {
    graph.nodes.push({
      id: e.id,
      kind: "enum",
      name: e.name,
      filePath: e.filePath,
      location: e.location,
      data: { meta: { members: e.members } },
    });
  }
  for (const f of analysis.functions) {
    graph.nodes.push({
      id: f.id,
      kind: "function",
      name: f.name,
      filePath: f.filePath,
      location: f.location,
      data: { methods: toMethodInfo([functionAsMethod(f)]) },
    });
  }

  // --- Edges ---
  const seen = new Set<string>();
  const addEdge = (
    source: string,
    target: string,
    kind: EdgeKind,
    label?: string,
  ): void => {
    if (source === target) return;
    const key = `${kind}:${source}->${target}:${label ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    const edge: IREdge = { id: key, source, target, kind };
    if (label) edge.label = label;
    graph.edges.push(edge);
  };

  const resolveToken = (fileRel: string, typeText?: string): string | undefined => {
    for (const token of typeTokens(typeText)) {
      const id = resolver.resolve(fileRel, token);
      if (id) return id;
    }
    return undefined;
  };

  for (const c of analysis.classes) {
    // Inheritance / implements.
    const baseId = resolveToken(c.filePath, c.extends);
    if (baseId) addEdge(c.id, baseId, "inheritance");
    for (const impl of c.implements) {
      const implId = resolveToken(c.filePath, impl);
      if (implId) addEdge(c.id, implId, "implements");
    }

    // Type-based dependencies from properties and method signatures.
    const structuralTargets = new Set<string>([...(baseId ? [baseId] : [])]);
    for (const impl of c.implements) {
      const implId = resolveToken(c.filePath, impl);
      if (implId) structuralTargets.add(implId);
    }
    for (const dep of collectTypeDependencies(c, resolver)) {
      if (!structuralTargets.has(dep)) addEdge(c.id, dep, "dependency");
    }

    // Calls and object creation from method bodies.
    addReferenceEdges(c, resolver, addEdge);
  }

  for (const i of analysis.interfaces) {
    for (const ext of i.extends) {
      const extId = resolveToken(i.filePath, ext);
      if (extId) addEdge(i.id, extId, "inheritance");
    }
  }

  for (const f of analysis.functions) {
    for (const ref of f.references) {
      const targetId = resolver.resolve(f.filePath, ref.name);
      if (!targetId) continue;
      addEdge(f.id, targetId, ref.kind === "new" ? "creates" : "calls", ref.name);
    }
  }

  return graph;
}

function functionAsMethod(f: AnalyzedFunction): AnalyzedMethod {
  return {
    name: f.name,
    returnType: f.returnType,
    visibility: "public",
    isStatic: false,
    isAsync: f.isAsync,
    parameters: f.parameters,
    location: f.location,
    references: f.references,
  };
}

/** Type tokens referenced by a class's properties and method signatures. */
function collectTypeDependencies(
  cls: AnalyzedClass,
  resolver: Resolver,
): Set<string> {
  const deps = new Set<string>();
  const addType = (typeText?: string): void => {
    for (const token of typeTokens(typeText)) {
      const id = resolver.resolve(cls.filePath, token);
      if (id && id !== cls.id) deps.add(id);
    }
  };
  for (const p of cls.properties) addType(p.type);
  for (const m of cls.methods) {
    addType(m.returnType);
    for (const param of m.parameters) addType(param.type);
  }
  return deps;
}

/**
 * Resolve call/new references inside a class's methods to concrete targets.
 *
 * - `new X()`               -> creates edge to X
 * - `this.prop.method()`    -> calls edge to the class typing `prop`
 * - `freeFunction()`        -> calls edge to that function
 */
function addReferenceEdges(
  cls: AnalyzedClass,
  resolver: Resolver,
  addEdge: (source: string, target: string, kind: EdgeKind, label?: string) => void,
): void {
  // Map own property name -> resolved type symbol id (for receiver typing).
  const propType = new Map<string, string>();
  for (const p of cls.properties) {
    for (const token of typeTokens(p.type)) {
      const id = resolver.resolve(cls.filePath, token);
      if (id) {
        propType.set(p.name, id);
        break;
      }
    }
  }

  for (const method of cls.methods) {
    for (const ref of method.references) {
      resolveReference(cls, ref, resolver, propType, addEdge);
    }
  }
}

function resolveReference(
  cls: AnalyzedClass,
  ref: SymbolReference,
  resolver: Resolver,
  propType: Map<string, string>,
  addEdge: (source: string, target: string, kind: EdgeKind, label?: string) => void,
): void {
  if (ref.kind === "new") {
    const targetId = resolver.resolve(cls.filePath, ref.name);
    if (targetId) addEdge(cls.id, targetId, "creates", ref.name);
    return;
  }

  if (ref.kind === "call") {
    const targetId = resolver.resolve(cls.filePath, ref.name);
    if (targetId) addEdge(cls.id, targetId, "calls", ref.name);
    return;
  }

  // member-call: try to type the receiver.
  const receiver = ref.receiver ?? "";
  if (receiver.startsWith("this.")) {
    const propName = receiver.slice("this.".length);
    const targetId = propType.get(propName);
    if (targetId) addEdge(cls.id, targetId, "calls", ref.name);
    return;
  }
  // Static call on an imported/known symbol, e.g. `UserService.create()`.
  const staticTarget = resolver.resolve(cls.filePath, receiver);
  if (staticTarget) addEdge(cls.id, staticTarget, "calls", ref.name);
}
