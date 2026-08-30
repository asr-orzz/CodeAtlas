export { classifyRole, tagRoles, roleLabel } from "./roles.js";
export type { ArchitectureRole } from "./roles.js";
export {
  aggregate,
  aggregateByRole,
  aggregateByDirectory,
} from "./aggregate.js";
export type { AggregateOptions, GroupOf } from "./aggregate.js";
export { computeArchitectureReport } from "./report.js";
export type {
  ArchitectureReport,
  DetectedCycle,
  RankedNode,
} from "./report.js";
