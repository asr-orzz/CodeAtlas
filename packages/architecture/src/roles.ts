import type { ArchitectureGraph, IRNode } from "@archx/core";

/** A coarse architectural role inferred from naming and folder conventions. */
export type ArchitectureRole =
  | "controller"
  | "service"
  | "repository"
  | "model"
  | "database"
  | "api"
  | "util"
  | "component"
  | "other";

interface RoleRule {
  role: ArchitectureRole;
  test: RegExp;
}

// Order matters: the first matching rule wins.
const RULES: RoleRule[] = [
  { role: "controller", test: /controller|\bhandler\b/i },
  { role: "service", test: /service|usecase|use-case|manager|provider/i },
  { role: "repository", test: /repositor|\brepo\b|\bdao\b|store|persistence/i },
  { role: "database", test: /database|\bdb\b|datasource|prisma|sequelize|mongoose/i },
  { role: "api", test: /\bapi\b|route|router|endpoint|graphql|resolver/i },
  { role: "util", test: /util|helper|common|shared|lib\b/i },
  { role: "model", test: /model|entity|\bdto\b|schema|\btype[s]?\b/i },
];

/** Classify a single node into an architectural role. */
export function classifyRole(node: IRNode): ArchitectureRole {
  const haystack = `${node.name} ${node.filePath ?? ""}`;
  for (const rule of RULES) {
    if (rule.test.test(haystack)) return rule.role;
  }
  if (node.kind === "interface" || node.kind === "enum") return "model";
  if (node.kind === "class" || node.kind === "function") return "component";
  return "other";
}

/** Return a copy of the graph with every node tagged with its role in `data.group`. */
export function tagRoles(graph: ArchitectureGraph): ArchitectureGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      data: { ...node.data, group: classifyRole(node) },
    })),
  };
}

/** Human-friendly plural label for a role, e.g. "repository" -> "Repositories". */
export function roleLabel(role: ArchitectureRole): string {
  const capitalized = role.charAt(0).toUpperCase() + role.slice(1);
  // Words ending in a consonant + "y" pluralize as "...ies".
  if (/[^aeiou]y$/i.test(capitalized)) return `${capitalized.slice(0, -1)}ies`;
  return `${capitalized}s`;
}
