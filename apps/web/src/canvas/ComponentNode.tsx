import { Handle, Position, type NodeProps } from "reactflow";
import type { DiagramNode } from "../types";

type Data = DiagramNode["data"] & { label: string };

export function ComponentNode({ data }: NodeProps<Data>) {
  const count = data.memberCount ?? 0;
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 shadow-lg">
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <div className="text-sm font-semibold text-slate-100">{data.label}</div>
      {count > 0 && (
        <div className="text-[11px] text-slate-400">{count} members</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}
