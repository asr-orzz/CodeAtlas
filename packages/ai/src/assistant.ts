import type { ArchitectureGraph } from "@archx/core";
import type { ArchitectureReport } from "@archx/architecture";
import { explainArchitecture, explainCycles } from "./explain.js";
import type { AiProvider } from "./provider.js";
import { detectSmells, type Smell } from "./smells.js";

export interface Answer {
  answer: string;
  /** Whether the answer came from an LLM provider or the deterministic engine. */
  source: "provider" | "deterministic";
}

/**
 * The architecture assistant. Explanations, cycle reports and smell detection
 * are always deterministic (computed from the IR). Free-form questions are
 * routed to a provider when available, and otherwise handled by a keyword-based
 * deterministic responder so the feature works fully offline.
 */
export class ArchitectureAssistant {
  constructor(
    private readonly ir: ArchitectureGraph,
    private readonly report: ArchitectureReport,
    private readonly provider?: AiProvider,
  ) {}

  explain(): string {
    return explainArchitecture(this.ir, this.report);
  }

  smells(): Smell[] {
    return detectSmells(this.ir);
  }

  cycles(): string {
    return explainCycles(this.report);
  }

  async ask(question: string): Promise<Answer> {
    const q = question.trim();
    if (!q) return { answer: "Ask me about the architecture, cycles or smells.", source: "deterministic" };

    if (this.provider) {
      try {
        const answer = await this.provider.complete({
          system:
            "You are a software architecture assistant. Answer strictly using the provided facts about the codebase. Do not invent classes or relationships.",
          prompt: `${this.groundingContext()}\n\nQuestion: ${q}`,
        });
        return { answer, source: "provider" };
      } catch {
        // Fall through to the deterministic responder on provider failure.
      }
    }

    return { answer: this.deterministicAnswer(q), source: "deterministic" };
  }

  /** A compact, factual summary used to ground an LLM prompt. */
  groundingContext(): string {
    const topDependedUpon = this.report.mostDependedUpon
      .slice(0, 5)
      .map((n) => `${n.name} (${n.count} dependents)`)
      .join(", ");
    const smells = detectSmells(this.ir)
      .map((s) => `- ${s.title}: ${s.detail}`)
      .join("\n");
    const nodeList = this.ir.nodes
      .slice(0, 60)
      .map((n) => `${n.name} [${n.kind}]`)
      .join(", ");
    return [
      "Architecture facts:",
      `- Nodes: ${this.report.nodeCount}, Edges: ${this.report.edgeCount}`,
      `- Layered (acyclic): ${this.report.isLayered}`,
      `- Cycles: ${this.report.cycles.length}`,
      `- Most depended-upon: ${topDependedUpon || "n/a"}`,
      `- Types: ${nodeList}`,
      smells ? `- Smells:\n${smells}` : "- Smells: none",
    ].join("\n");
  }

  private deterministicAnswer(q: string): string {
    const lower = q.toLowerCase();
    if (/(cycle|circular|loop)/.test(lower)) return this.cycles();
    if (/(smell|problem|issue|wrong|violation|anti-?pattern)/.test(lower)) {
      const smells = this.smells();
      if (smells.length === 0) return "No structural smells were detected.";
      return smells.map((s) => `- **${s.title}** — ${s.detail}`).join("\n");
    }
    if (/(most|import|central|hub|used|depend)/.test(lower)) {
      if (this.report.mostDependedUpon.length === 0) return "No dependency information is available.";
      return [
        "Most depended-upon types (architectural hubs):",
        ...this.report.mostDependedUpon
          .slice(0, 5)
          .map((n) => `- ${n.name}: ${n.count} dependents`),
      ].join("\n");
    }
    // Default: a full architecture explanation.
    return this.explain();
  }
}
