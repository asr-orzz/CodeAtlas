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

const HANDLE_CLASS =
  "!h-3 !w-3 !rounded-full !border-2 !border-surface-raised !bg-accent";

export function EntityNode({ data }: NodeProps<Data>) {
  const color =
    (data.group && GROUP_COLORS[data.group]) ?? "border-surface-border bg-surface-raised";
  return (
    <div className={`rounded-md border px-3 py-2 text-center shadow ${color}`}>
      <Handle type="target" position={Position.Top} className={HANDLE_CLASS} />
      <Handle type="target" position={Position.Left} id="l" className={HANDLE_CLASS} />
      <span className="text-xs font-medium text-slate-100">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Right} id="r" className={HANDLE_CLASS} />
    </div>
  );
}
