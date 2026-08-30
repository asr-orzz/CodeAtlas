import type { ArchitectureGraph } from "@archx/core";
import type { ArchitectureReport } from "@archx/architecture";
import { classifyRole, roleLabel, type ArchitectureRole } from "@archx/architecture";
import { detectSmells } from "./smells.js";

const ROLE_ORDER: ArchitectureRole[] = [
  "controller",
  "api",
  "service",
  "repository",
  "database",
  "model",
  "util",
  "component",
  "other",
];

/** Count nodes per architectural role. */
function roleBreakdown(ir: ArchitectureGraph): Map<ArchitectureRole, number> {
  const counts = new Map<ArchitectureRole, number>();
  for (const node of ir.nodes) {
    const role = classifyRole(node);
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return counts;
}

/**
 * Produce a fact-based, human-readable explanation of the architecture in
 * Markdown. Every statement is derived from the IR and report — no guessing.
 */
export function explainArchitecture(
  ir: ArchitectureGraph,
  report: ArchitectureReport,
): string {
  const lines: string[] = [];
  lines.push("## Architecture overview");
  lines.push(
    `This codebase has **${report.nodeCount} types** connected by **${report.edgeCount} relationships**.`,
  );

  const roles = roleBreakdown(ir);
  const roleParts = ROLE_ORDER.filter((r) => roles.get(r))
    .map((r) => `${roles.get(r)} ${roleLabel(r).toLowerCase()}`);
  if (roleParts.length > 0) {
    lines.push(`It is composed of ${joinWithAnd(roleParts)}.`);
  }

  lines.push("");
  lines.push("### Layering");
  if (report.isLayered) {
    lines.push(
      "The dependency graph is **acyclic**, so the code can be cleanly layered — dependencies flow in one direction.",
    );
  } else {
    lines.push(
      `The dependency graph contains **${report.cycles.length} cycle(s)**, so it is not strictly layered. See the cycles below.`,
    );
  }

  if (report.mostDependedUpon.length > 0) {
    lines.push("");
    lines.push("### Most depended-upon types");
    for (const n of report.mostDependedUpon.slice(0, 5)) {
      lines.push(`- **${n.name}** — ${n.count} dependents`);
    }
    lines.push(
      "These are architectural hubs: changes here ripple widely, so they deserve the most stable interfaces.",
    );
  }

  const smells = detectSmells(ir);
  lines.push("");
  lines.push("### Health");
  if (smells.length === 0) {
    lines.push("No structural smells were detected. 👍");
  } else {
    const errors = smells.filter((s) => s.severity === "error").length;
    const warnings = smells.filter((s) => s.severity === "warning").length;
    lines.push(
      `Detected **${smells.length} potential issue(s)** (${errors} error, ${warnings} warning). Ask for "smells" to see details.`,
    );
  }

  return lines.join("\n");
}

/** Explain each dependency cycle in plain language. */
export function explainCycles(report: ArchitectureReport): string {
  if (report.cycles.length === 0) {
    return "No dependency cycles were found — the dependency graph is acyclic.";
  }
  const lines = [`Found **${report.cycles.length} dependency cycle(s)**:`, ""];
  report.cycles.forEach((cycle, i) => {
    lines.push(`${i + 1}. ${cycle.names.join(" → ")} → ${cycle.names[0]}`);
  });
  lines.push("");
  lines.push(
    "Break a cycle by inverting one dependency (dependency injection / interfaces) or by extracting the shared concern into a separate module.",
  );
  return lines.join("\n");
}

function joinWithAnd(parts: string[]): string {
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}
