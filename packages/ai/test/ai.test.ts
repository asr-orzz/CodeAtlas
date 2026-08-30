import { emptyGraph, type ArchitectureGraph } from "@archx/core";
import { computeArchitectureReport } from "@archx/architecture";
import { describe, expect, it } from "vitest";
import { ArchitectureAssistant, detectSmells, type AiProvider } from "@archx/ai";

function node(id: string, name: string, filePath: string) {
  return { id, kind: "class" as const, name, filePath };
}

/** Controller -> Service -> Repository -> Database, plus a bad shortcut. */
function layeredIR(): ArchitectureGraph {
  const g = emptyGraph();
  g.nodes = [
    node("c", "UserController", "src/user.controller.ts"),
    node("s", "UserService", "src/user.service.ts"),
    node("r", "UserRepository", "src/user.repository.ts"),
    node("d", "Database", "src/database.ts"),
  ];
  g.edges = [
    { id: "e1", source: "c", target: "s", kind: "dependency" },
    { id: "e2", source: "s", target: "r", kind: "dependency" },
    { id: "e3", source: "r", target: "d", kind: "dependency" },
    // Controller reaching straight to the Database, skipping layers.
    { id: "e4", source: "c", target: "d", kind: "dependency" },
  ];
  return g;
}

function cyclicIR(): ArchitectureGraph {
  const g = emptyGraph();
  g.nodes = [node("a", "A", "a.ts"), node("b", "B", "b.ts")];
  g.edges = [
    { id: "e1", source: "a", target: "b", kind: "dependency" },
    { id: "e2", source: "b", target: "a", kind: "dependency" },
  ];
  return g;
}

describe("detectSmells", () => {
  it("flags a layer-skipping dependency", () => {
    const smells = detectSmells(layeredIR());
    expect(smells.some((s) => s.kind === "layering")).toBe(true);
  });

  it("flags circular dependencies", () => {
    const smells = detectSmells(cyclicIR());
    expect(smells.some((s) => s.kind === "cycle" && s.severity === "error")).toBe(true);
  });
});

describe("ArchitectureAssistant", () => {
  it("explains a layered architecture", () => {
    const ir = layeredIR();
    const assistant = new ArchitectureAssistant(ir, computeArchitectureReport(ir));
    const text = assistant.explain();
    expect(text).toContain("Architecture overview");
    expect(text.toLowerCase()).toContain("layer");
  });

  it("answers cycle questions deterministically", async () => {
    const ir = cyclicIR();
    const assistant = new ArchitectureAssistant(ir, computeArchitectureReport(ir));
    const { answer, source } = await assistant.ask("are there any circular dependencies?");
    expect(source).toBe("deterministic");
    expect(answer.toLowerCase()).toContain("cycle");
  });

  it("uses a provider when one is supplied", async () => {
    const ir = layeredIR();
    const provider: AiProvider = {
      name: "stub",
      complete: async ({ prompt }) => `ECHO: ${prompt.includes("Architecture facts") ? "grounded" : "bare"}`,
    };
    const assistant = new ArchitectureAssistant(ir, computeArchitectureReport(ir), provider);
    const { answer, source } = await assistant.ask("what is this?");
    expect(source).toBe("provider");
    expect(answer).toBe("ECHO: grounded");
  });

  it("falls back to deterministic answers when the provider throws", async () => {
    const ir = layeredIR();
    const provider: AiProvider = {
      name: "broken",
      complete: async () => {
        throw new Error("no network");
      },
    };
    const assistant = new ArchitectureAssistant(ir, computeArchitectureReport(ir), provider);
    const { source } = await assistant.ask("explain the architecture");
    expect(source).toBe("deterministic");
  });
});
