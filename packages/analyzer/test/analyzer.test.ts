import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "@archx/analyzer";
import type { SourceAnalysis } from "@archx/analyzer";

const fixtureRoot = fileURLToPath(new URL("./fixtures/sample", import.meta.url));

function analyze(): SourceAnalysis {
  return analyzeProject(fixtureRoot);
}

describe("analyzeProject", () => {
  const analysis = analyze();

  it("finds every class and interface", () => {
    const classNames = analysis.classes.map((c) => c.name).sort();
    expect(classNames).toEqual([
      "Database",
      "UserController",
      "UserRepository",
      "UserService",
    ]);
    const interfaceNames = analysis.interfaces.map((i) => i.name).sort();
    expect(interfaceNames).toEqual(["Repository", "User"]);
  });

  it("captures implements relationships", () => {
    const repo = analysis.classes.find((c) => c.name === "UserRepository")!;
    expect(repo.implements).toContain("Repository");
    expect(repo.extends).toBeUndefined();
  });

  it("captures constructor parameter properties", () => {
    const ctrl = analysis.classes.find((c) => c.name === "UserController")!;
    const serviceProp = ctrl.properties.find((p) => p.name === "service");
    expect(serviceProp).toBeDefined();
    expect(serviceProp!.type).toBe("UserService");
    expect(serviceProp!.visibility).toBe("private");
    expect(serviceProp!.isReadonly).toBe(true);
  });

  it("captures member-call references", () => {
    const ctrl = analysis.classes.find((c) => c.name === "UserController")!;
    const show = ctrl.methods.find((m) => m.name === "show")!;
    const call = show.references.find((r) => r.name === "getUser");
    expect(call).toBeDefined();
    expect(call!.kind).toBe("member-call");
    expect(call!.receiver).toBe("this.service");
  });

  it("captures new-expression references", () => {
    const svc = analysis.classes.find((c) => c.name === "UserService")!;
    const ctor = svc.methods.find((m) => m.name === "constructor")!;
    const created = ctor.references.find((r) => r.name === "UserRepository");
    expect(created).toBeDefined();
    expect(created!.kind).toBe("new");
  });

  it("resolves relative imports to project files", () => {
    const ctrlFile = analysis.files.find((f) => f.path === "UserController.ts")!;
    const svcImport = ctrlFile.imports.find(
      (i) => i.moduleSpecifier === "./UserService.js",
    )!;
    expect(svcImport.isRelative).toBe(true);
    expect(svcImport.resolvedFilePath).toBe("UserService.ts");
    expect(svcImport.namedImports).toContain("UserService");
  });

  it("records source locations", () => {
    const db = analysis.classes.find((c) => c.name === "Database")!;
    expect(db.location.file).toBe("Database.ts");
    expect(db.location.line).toBeGreaterThan(0);
  });
});
