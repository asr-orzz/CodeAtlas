import { Handle, Position, type NodeProps } from "reactflow";
import type { DiagramNode } from "../types";

type Data = DiagramNode["data"] & { label: string };

const HANDLE_CLASS =
  "!h-3 !w-3 !rounded-full !border-2 !border-surface-raised !bg-accent";

export function ComponentNode({ data }: NodeProps<Data>) {
  const count = data.memberCount ?? 0;
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 shadow-lg">
      <Handle type="target" position={Position.Top} className={HANDLE_CLASS} />
      <Handle type="target" position={Position.Left} id="l" className={HANDLE_CLASS} />
      <div className="text-sm font-semibold text-slate-100">{data.label}</div>
      {count > 0 && (
        <div className="text-[11px] text-slate-400">{count} members</div>
      )}
      <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Right} id="r" className={HANDLE_CLASS} />
    </div>
  );
}
