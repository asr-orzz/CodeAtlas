import path from "node:path";
import {
  Node,
  Project,
  Scope,
  SyntaxKind,
  type ClassDeclaration,
  type ConstructorDeclaration,
  type FunctionDeclaration,
  type InterfaceDeclaration,
  type MethodDeclaration,
  type MethodSignature,
  type ParameterDeclaration,
  type PropertyDeclaration,
  type PropertySignature,
  type SourceFile,
} from "ts-morph";
import type { SourceLocation, Visibility } from "@archx/core";
import { collectSourceFiles, languageForFile } from "./collect-files.js";
import { resolveRelativeImport, toRelativePosix } from "./resolve.js";
import type {
  AnalyzedClass,
  AnalyzedEnum,
  AnalyzedFile,
  AnalyzedFunction,
  AnalyzedImport,
  AnalyzedInterface,
  AnalyzedMethod,
  AnalyzedParameter,
  AnalyzedProperty,
  AnalyzeOptions,
  Language,
  SourceAnalysis,
  SymbolReference,
} from "./types.js";

/** Stable id for a top-level declaration: "relative/path.ts#Name". */
export function declarationId(relPath: string, name: string): string {
  return `${relPath}#${name}`;
}

function toVisibility(scope: Scope | undefined): Visibility {
  switch (scope) {
    case Scope.Private:
      return "private";
    case Scope.Protected:
      return "protected";
    default:
      return "public";
  }
}

/**
 * Analyze a directory of TypeScript/JavaScript source into a resolution-light
 * set of facts (classes, interfaces, enums, functions, imports, references).
 * Nothing here is inferred by an LLM — it is all read straight from the AST.
 */
export function analyzeProject(
  rootPath: string,
  options: AnalyzeOptions = {},
): SourceAnalysis {
  const absRoot = path.resolve(rootPath);
  const warnings: string[] = [];

  const { files: absFiles, truncated } = collectSourceFiles(absRoot, {
    extensions: options.extensions,
    ignoreDirs: options.ignoreDirs,
    maxFiles: options.maxFiles,
  });
  if (truncated) {
    warnings.push(
      `File limit reached; analysis was truncated to ${absFiles.length} files.`,
    );
  }

  const fileSet = new Set(absFiles.map((f) => path.resolve(f)));

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true },
  });

  const sourceFiles: SourceFile[] = [];
  for (const abs of absFiles) {
    try {
      sourceFiles.push(project.addSourceFileAtPath(abs));
    } catch (err) {
      warnings.push(`Failed to parse ${toRelativePosix(absRoot, abs)}: ${String(err)}`);
    }
  }

  const analysis: SourceAnalysis = {
    rootPath: absRoot,
    files: [],
    classes: [],
    interfaces: [],
    enums: [],
    functions: [],
    warnings,
  };

  for (const sf of sourceFiles) {
    const abs = path.resolve(sf.getFilePath());
    const rel = toRelativePosix(absRoot, abs);
    const language: Language = languageForFile(abs) ?? "ts";

    const getLoc = (node: Node): SourceLocation => {
      const { line, column } = sf.getLineAndColumnAtPos(node.getStart());
      return { file: rel, line, column };
    };

    analysis.files.push(analyzeImports(sf, abs, rel, fileSet, absRoot));

    for (const cls of sf.getClasses()) {
      const named = cls.getName();
      if (!named) continue;
      analysis.classes.push(analyzeClass(cls, rel, named, getLoc));
    }
    for (const iface of sf.getInterfaces()) {
      analysis.interfaces.push(analyzeInterface(iface, rel, getLoc));
    }
    for (const en of sf.getEnums()) {
      analysis.enums.push({
        id: declarationId(rel, en.getName()),
        name: en.getName(),
        filePath: rel,
        location: getLoc(en),
        members: en.getMembers().map((m) => m.getName()),
      });
    }
    for (const fn of sf.getFunctions()) {
      const named = fn.getName();
      if (!named) continue;
      analysis.functions.push(analyzeFunction(fn, rel, named, getLoc));
    }
  }

  return analysis;
}

function analyzeImports(
  sf: SourceFile,
  abs: string,
  rel: string,
  fileSet: ReadonlySet<string>,
  absRoot: string,
): AnalyzedFile {
  const imports: AnalyzedImport[] = [];
  for (const decl of sf.getImportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    const isRelative = specifier.startsWith(".");
    const resolvedAbs = isRelative
      ? resolveRelativeImport(abs, specifier, fileSet)
      : undefined;
    imports.push({
      moduleSpecifier: specifier,
      isRelative,
      resolvedFilePath: resolvedAbs ? toRelativePosix(absRoot, resolvedAbs) : undefined,
      namedImports: decl.getNamedImports().map((n) => n.getName()),
      defaultImport: decl.getDefaultImport()?.getText(),
      namespaceImport: decl.getNamespaceImport()?.getText(),
    });
  }
  return {
    path: rel,
    language: languageForFile(abs) ?? "ts",
    imports,
  };
}

function analyzeParameters(
  params: ParameterDeclaration[],
): AnalyzedParameter[] {
  return params.map((p) => ({
    name: p.getName(),
    type: p.getTypeNode()?.getText(),
  }));
}

function analyzeClass(
  cls: ClassDeclaration,
  rel: string,
  name: string,
  getLoc: (node: Node) => SourceLocation,
): AnalyzedClass {
  const properties: AnalyzedProperty[] = cls
    .getProperties()
    .map((prop: PropertyDeclaration) => ({
      name: prop.getName(),
      type: prop.getTypeNode()?.getText(),
      visibility: toVisibility(prop.getScope()),
      isStatic: prop.isStatic(),
      isReadonly: prop.isReadonly(),
    }));

  const methods: AnalyzedMethod[] = cls
    .getMethods()
    .map((m: MethodDeclaration) => ({
      name: m.getName(),
      returnType: m.getReturnTypeNode()?.getText(),
      visibility: toVisibility(m.getScope()),
      isStatic: m.isStatic(),
      isAsync: m.isAsync(),
      parameters: analyzeParameters(m.getParameters()),
      location: getLoc(m),
      references: collectReferences(m, rel),
    }));

  // Constructors are captured too: their parameter types are a strong
  // dependency-injection signal, and their bodies contain useful calls.
  for (const ctor of cls.getConstructors() as ConstructorDeclaration[]) {
    // Parameter properties (e.g. `private service: UserService`) show up as
    // constructor parameters with a scope/readonly modifier — record them as
    // real properties so the class UML and dependency graph can see them.
    for (const param of ctor.getParameters()) {
      if (param.getScope() !== undefined || param.isReadonly()) {
        properties.push({
          name: param.getName(),
          type: param.getTypeNode()?.getText(),
          visibility: toVisibility(param.getScope()),
          isStatic: false,
          isReadonly: param.isReadonly(),
        });
      }
    }
    methods.push({
      name: "constructor",
      returnType: undefined,
      visibility: "public",
      isStatic: false,
      isAsync: false,
      parameters: analyzeParameters(ctor.getParameters()),
      location: getLoc(ctor),
      references: collectReferences(ctor, rel),
    });
  }

  return {
    id: declarationId(rel, name),
    name,
    filePath: rel,
    location: getLoc(cls),
    isAbstract: cls.isAbstract(),
    extends: cls.getExtends()?.getExpression().getText(),
    implements: cls.getImplements().map((i) => i.getExpression().getText()),
    properties,
    methods,
  };
}

function analyzeInterface(
  iface: InterfaceDeclaration,
  rel: string,
  getLoc: (node: Node) => SourceLocation,
): AnalyzedInterface {
  const properties: AnalyzedProperty[] = iface
    .getProperties()
    .map((prop: PropertySignature) => ({
      name: prop.getName(),
      type: prop.getTypeNode()?.getText(),
      visibility: "public" as Visibility,
      isStatic: false,
      isReadonly: prop.isReadonly(),
    }));

  const methods: AnalyzedMethod[] = iface
    .getMethods()
    .map((m: MethodSignature) => ({
      name: m.getName(),
      returnType: m.getReturnTypeNode()?.getText(),
      visibility: "public" as Visibility,
      isStatic: false,
      isAsync: false,
      parameters: analyzeParameters(m.getParameters()),
      location: getLoc(m),
      references: [],
    }));

  return {
    id: declarationId(rel, iface.getName()),
    name: iface.getName(),
    filePath: rel,
    location: getLoc(iface),
    extends: iface.getExtends().map((e) => e.getExpression().getText()),
    properties,
    methods,
  };
}

function analyzeFunction(
  fn: FunctionDeclaration,
  rel: string,
  name: string,
  getLoc: (node: Node) => SourceLocation,
): AnalyzedFunction {
  return {
    id: declarationId(rel, name),
    name,
    filePath: rel,
    location: getLoc(fn),
    isAsync: fn.isAsync(),
    parameters: analyzeParameters(fn.getParameters()),
    returnType: fn.getReturnTypeNode()?.getText(),
    references: collectReferences(fn, rel),
  };
}

/** Collect call/new references inside a declaration's body. */
function collectReferences(node: Node, relPath: string): SymbolReference[] {
  const refs: SymbolReference[] = [];
  const sf = node.getSourceFile();
  const locOf = (target: Node): SourceLocation => {
    const { line, column } = sf.getLineAndColumnAtPos(target.getStart());
    return { file: relPath, line, column };
  };

  for (const call of node.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      refs.push({
        name: expr.getName(),
        kind: "member-call",
        receiver: expr.getExpression().getText(),
        location: locOf(call),
      });
    } else if (Node.isIdentifier(expr)) {
      refs.push({ name: expr.getText(), kind: "call", location: locOf(call) });
    }
  }

  for (const neu of node.getDescendantsOfKind(SyntaxKind.NewExpression)) {
    const expr = neu.getExpression();
    const name = Node.isPropertyAccessExpression(expr)
      ? expr.getName()
      : expr.getText();
    refs.push({ name, kind: "new", location: locOf(neu) });
  }

  return refs;
}
