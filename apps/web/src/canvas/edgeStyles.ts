import { MarkerType, type Edge } from "reactflow";
import type { DiagramEdge } from "../types";

interface EdgeVisual {
  color: string;
  dashed?: boolean;
  closedArrow?: boolean;
}

const EDGE_VISUALS: Record<string, EdgeVisual> = {
  inheritance: { color: "#818cf8", closedArrow: true },
  implements: { color: "#34d399", dashed: true, closedArrow: true },
  dependency: { color: "#64748b", dashed: true },
  creates: { color: "#f59e0b" },
  calls: { color: "#38bdf8" },
  association: { color: "#94a3b8" },
  composition: { color: "#c084fc" },
  aggregation: { color: "#a78bfa" },
  uses: { color: "#64748b", dashed: true },
  message: { color: "#38bdf8" },
};

/** Convert a diagram edge into a styled React Flow edge. */
export function toReactFlowEdge(edge: DiagramEdge): Edge {
  const visual = EDGE_VISUALS[edge.type] ?? { color: "#64748b" };
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep",
    labelStyle: { fill: "#cbd5e1", fontSize: 11 },
    labelBgStyle: { fill: "#171a23" },
    style: {
      stroke: visual.color,
      strokeWidth: 1.5,
      strokeDasharray: visual.dashed ? "5 4" : undefined,
    },
    markerEnd: {
      type: visual.closedArrow ? MarkerType.ArrowClosed : MarkerType.Arrow,
      color: visual.color,
      width: 16,
      height: 16,
    },
  };
}
