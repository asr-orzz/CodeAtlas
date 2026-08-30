import type { ArchitectureGraph } from "@archx/core";
import { GraphTools, type NodeRef } from "./tools.js";

/**
 * An instruction the assistant can send back to the UI to drive the canvas.
 * The frontend decides how to apply each one.
 */
export type CanvasAction =
  | { type: "focusNode"; nodeId: string }
  | { type: "showDiagram"; kind: "class" | "component" | "dependency" | "call" }
  | { type: "generateSequence"; entryId: string }
  | { type: "highlightNodes"; nodeIds: string[] };

export interface AgentResult {
  answer: string;
  matches?: NodeRef[];
  action?: CanvasAction;
}

const LIST_LIMIT = 25;

/**
 * A deterministic command interpreter. It recognizes a small set of graph
 * queries and canvas commands, resolves node names against the IR, and returns
 * a factual answer plus an optional canvas action. Returns `null` when nothing
 * matched so the caller can fall back to an LLM or a generic explanation.
 */
export function interpretCommand(
  question: string,
  ir: ArchitectureGraph,
): AgentResult | null {
  const tools = new GraphTools(ir);
  const q = question.trim();
  const lower = q.toLowerCase();

  const resolve = (raw: string): { node?: NodeRef; candidates: NodeRef[] } => {
    const matches = tools.search(raw);
    if (matches.length === 0) return { candidates: [] };
    // Exact (case-insensitive) name wins even if others contain the term.
    const exact = matches.find((m) => m.name.toLowerCase() === raw.toLowerCase());
    return { node: exact ?? matches[0], candidates: matches };
  };

  const listAnswer = (title: string, refs: NodeRef[]): string => {
    if (refs.length === 0) return `${title}: none.`;
    const shown = refs.slice(0, LIST_LIMIT).map((r) => `- ${r.name}`);
    const more = refs.length > LIST_LIMIT ? `\n…and ${refs.length - LIST_LIMIT} more` : "";
    return `${title} (${refs.length}):\n${shown.join("\n")}${more}`;
  };

  // path from A to B
  const pathMatch = lower.match(/(?:path|route|reach|connect).*?from\s+(.+?)\s+to\s+(.+)$/i)
    ?? q.match(/from\s+(.+?)\s+to\s+(.+)$/i);
  if (pathMatch) {
    const a = resolve(pathMatch[1]!.trim());
    const b = resolve(pathMatch[2]!.trim());
    if (!a.node || !b.node) {
      return { answer: `I couldn't find ${!a.node ? pathMatch[1] : pathMatch[2]} in this codebase.` };
    }
    const result = tools.path(a.node.id, b.node.id);
    if (!result.found) {
      return {
        answer: `There is no dependency path from **${a.node.name}** to **${b.node.name}**.`,
      };
    }
    return {
      answer: `Dependency path: ${result.nodes.map((n) => n.name).join(" → ")}`,
      matches: result.nodes,
      action: { type: "highlightNodes", nodeIds: result.nodes.map((n) => n.id) },
    };
  }

  const target = (patterns: RegExp[]): { node?: NodeRef; candidates: NodeRef[]; raw?: string } | null => {
    for (const re of patterns) {
      const m = q.match(re);
      if (m && m[1]) {
        const raw = m[1].trim().replace(/[?.!]+$/, "");
        return { ...resolve(raw), raw };
      }
    }
    return null;
  };

  const ambiguous = (r: { node?: NodeRef; candidates: NodeRef[]; raw?: string }): AgentResult | null => {
    if (r.node) return null;
    if (r.candidates.length === 0)
      return { answer: `I couldn't find "${r.raw}" in this codebase.` };
    return {
      answer: `Did you mean one of these?`,
      matches: r.candidates,
    };
  };

  // callers of X / who calls X
  const callers = target([/who\s+calls\s+(.+)/i, /callers?\s+of\s+(.+)/i]);
  if (callers) {
    const amb = ambiguous(callers);
    if (amb) return amb;
    const refs = tools.callers(callers.node!.id);
    return {
      answer: listAnswer(`Callers of ${callers.node!.name}`, refs),
      matches: refs,
      action: { type: "focusNode", nodeId: callers.node!.id },
    };
  }

  // callees / what does X call
  const callees = target([/what\s+does\s+(.+?)\s+call/i, /callees?\s+of\s+(.+)/i, /what\s+(.+?)\s+calls/i]);
  if (callees) {
    const amb = ambiguous(callees);
    if (amb) return amb;
    const refs = tools.callees(callees.node!.id);
    return {
      answer: listAnswer(`${callees.node!.name} calls`, refs),
      matches: refs,
      action: { type: "focusNode", nodeId: callees.node!.id },
    };
  }

  // dependents / who depends on X / who uses X
  const dependents = target([
    /who\s+depends\s+on\s+(.+)/i,
    /who\s+uses\s+(.+)/i,
    /dependents?\s+of\s+(.+)/i,
    /what\s+uses\s+(.+)/i,
  ]);
  if (dependents) {
    const amb = ambiguous(dependents);
    if (amb) return amb;
    const trans = /\b(all|transitive|indirect)\b/i.test(lower);
    const refs = tools.dependents(dependents.node!.id, trans);
    return {
      answer: listAnswer(`${trans ? "All dependents" : "Direct dependents"} of ${dependents.node!.name}`, refs),
      matches: refs,
      action: { type: "showDiagram", kind: "dependency" },
    };
  }

  // dependencies / what does X depend on
  const dependencies = target([
    /what\s+does\s+(.+?)\s+depend\s+on/i,
    /dependencies\s+of\s+(.+)/i,
    /what\s+(.+?)\s+depends\s+on/i,
  ]);
  if (dependencies) {
    const amb = ambiguous(dependencies);
    if (amb) return amb;
    const trans = /\b(all|transitive|indirect)\b/i.test(lower);
    const refs = tools.dependencies(dependencies.node!.id, trans);
    return {
      answer: listAnswer(`${trans ? "All dependencies" : "Direct dependencies"} of ${dependencies.node!.name}`, refs),
      matches: refs,
      action: { type: "showDiagram", kind: "dependency" },
    };
  }

  // sequence diagram for X / trace X
  const sequence = target([
    /sequence\s+(?:diagram\s+)?(?:for|of|from)\s+(.+)/i,
    /trace\s+(.+)/i,
  ]);
  if (sequence) {
    const amb = ambiguous(sequence);
    if (amb) return amb;
    return {
      answer: `Generating a sequence diagram starting from **${sequence.node!.name}**.`,
      matches: [sequence.node!],
      action: { type: "generateSequence", entryId: sequence.node!.id },
    };
  }

  // focus / show / highlight X
  const focus = target([/(?:focus|show me|highlight|find|where is)\s+(.+)/i]);
  if (focus) {
    const amb = ambiguous(focus);
    if (amb) return amb;
    return {
      answer: `Focusing on **${focus.node!.name}** (${focus.node!.kind}).`,
      matches: [focus.node!],
      action: { type: "focusNode", nodeId: focus.node!.id },
    };
  }

  return null;
}
