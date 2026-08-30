import { Handle, Position, type NodeProps } from "reactflow";
import type { DiagramNode } from "../types";

type Data = DiagramNode["data"] & { label: string };

const GROUP_COLORS: Record<string, string> = {
  controller: "border-sky-500/50 bg-sky-500/10",
  service: "border-indigo-500/50 bg-indigo-500/10",
  repository: "border-emerald-500/50 bg-emerald-500/10",
  database: "border-amber-500/50 bg-amber-500/10",
  model: "border-fuchsia-500/50 bg-fuchsia-500/10",
};

export function EntityNode({ data }: NodeProps<Data>) {
  const color =
    (data.group && GROUP_COLORS[data.group]) ?? "border-surface-border bg-surface-raised";
  return (
    <div className={`rounded-md border px-3 py-2 text-center shadow ${color}`}>
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <span className="text-xs font-medium text-slate-100">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}
