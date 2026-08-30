import type { SourceLocation, Visibility } from "@archx/core";

export type Language = "ts" | "tsx" | "js" | "jsx";

/** A reference to another symbol found inside a function/method body. */
export interface SymbolReference {
  /** The name being referenced, e.g. "UserService" or "findUser". */
  name: string;
  kind: "call" | "new" | "member-call";
  /** For member calls, the receiver expression text, e.g. "this.service". */
  receiver?: string;
  location: SourceLocation;
}

export interface AnalyzedParameter {
  name: string;
  type?: string;
}

export interface AnalyzedProperty {
  name: string;
  type?: string;
  visibility: Visibility;
  isStatic: boolean;
  isReadonly: boolean;
}

export interface AnalyzedMethod {
  name: string;
  returnType?: string;
  visibility: Visibility;
  isStatic: boolean;
  isAsync: boolean;
  parameters: AnalyzedParameter[];
  location: SourceLocation;
  /** Calls / instantiations found in this method's body. */
  references: SymbolReference[];
}

export interface AnalyzedClass {
  id: string;
  name: string;
  filePath: string;
  location: SourceLocation;
  isAbstract: boolean;
  extends?: string;
  implements: string[];
  properties: AnalyzedProperty[];
  methods: AnalyzedMethod[];
}

export interface AnalyzedInterface {
  id: string;
  name: string;
  filePath: string;
  location: SourceLocation;
  extends: string[];
  properties: AnalyzedProperty[];
  methods: AnalyzedMethod[];
}

export interface AnalyzedEnum {
  id: string;
  name: string;
  filePath: string;
  location: SourceLocation;
  members: string[];
}

export interface AnalyzedFunction {
  id: string;
  name: string;
  filePath: string;
  location: SourceLocation;
  isAsync: boolean;
  parameters: AnalyzedParameter[];
  returnType?: string;
  references: SymbolReference[];
}

export interface AnalyzedImport {
  moduleSpecifier: string;
  isRelative: boolean;
  /** Project-relative path of the resolved file, if the import points inside the project. */
  resolvedFilePath?: string;
  namedImports: string[];
  defaultImport?: string;
  namespaceImport?: string;
}

export interface AnalyzedFile {
  /** Project-relative path with forward slashes, e.g. "src/user/UserService.ts". */
  path: string;
  language: Language;
  imports: AnalyzedImport[];
}

/** The complete, resolution-light set of facts extracted from source. */
export interface SourceAnalysis {
  rootPath: string;
  files: AnalyzedFile[];
  classes: AnalyzedClass[];
  interfaces: AnalyzedInterface[];
  enums: AnalyzedEnum[];
  functions: AnalyzedFunction[];
  warnings: string[];
}

export interface AnalyzeOptions {
  /** Glob-ish include extensions. Defaults to ts/tsx/js/jsx. */
  extensions?: Language[];
  /** Directory names to ignore anywhere in the tree. */
  ignoreDirs?: string[];
  /** Hard cap on number of files analyzed (safety for huge repos). */
  maxFiles?: number;
}
