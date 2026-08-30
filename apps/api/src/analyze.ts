import { analyzeProject, buildArchitecture } from "@archx/analyzer";
import { computeArchitectureReport, tagRoles } from "@archx/architecture";
import type { ArchitectureGraph, ArchitectureMeta } from "@archx/core";
import type { ArchitectureReport } from "@archx/architecture";

export interface AnalysisResult {
  ir: ArchitectureGraph;
  report: ArchitectureReport;
}

/**
 * Run the full deterministic pipeline on a local directory:
 * static analysis -> Architecture IR -> role tagging -> metrics.
 */
export function runAnalysis(
  rootPath: string,
  meta: ArchitectureMeta = {},
): AnalysisResult {
  const analysis = analyzeProject(rootPath);
  const ir = tagRoles(buildArchitecture(analysis, meta));
  const report = computeArchitectureReport(ir);
  return { ir, report };
}
