import { Handle, Position, type NodeProps } from "reactflow";
import type { DiagramNode } from "../types";

type ClassNodeData = DiagramNode["data"] & { label: string; nodeType: string };

const KIND_BADGE: Record<string, { text: string; className: string }> = {
  class: { text: "C", className: "bg-indigo-500/20 text-indigo-300" },
  interface: { text: "I", className: "bg-emerald-500/20 text-emerald-300" },
  enum: { text: "E", className: "bg-amber-500/20 text-amber-300" },
};

function visibilitySymbol(visibility?: string): string {
  if (visibility === "private") return "−";
  if (visibility === "protected") return "#";
  return "+";
}

export function ClassNode({ data }: NodeProps<ClassNodeData>) {
  const badge = KIND_BADGE[data.nodeType] ?? KIND_BADGE.class!;
  const properties = data.properties ?? [];
  const methods = data.methods ?? [];

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-raised shadow-lg">
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />

      <div className="flex items-center gap-2 border-b border-surface-border bg-surface px-3 py-1.5">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${badge.className}`}
        >
          {badge.text}
        </span>
        <span className="truncate text-sm font-semibold text-slate-100">{data.label}</span>
      </div>

      {properties.length > 0 && (
        <div className="border-b border-surface-border px-3 py-1.5">
          {properties.map((p, i) => (
            <div key={i} className="truncate font-mono text-[11px] text-slate-400">
              {visibilitySymbol(p.visibility)} {p.name}
              {p.type ? `: ${p.type}` : ""}
            </div>
          ))}
        </div>
      )}

      {methods.length > 0 && (
        <div className="px-3 py-1.5">
          {methods.map((m, i) => (
            <div key={i} className="truncate font-mono text-[11px] text-slate-300">
              {visibilitySymbol(m.visibility)} {m.name}(
              {(m.parameters ?? []).map((param) => param.name).join(", ")})
              {m.returnType ? `: ${m.returnType}` : ""}
            </div>
          ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1 !w-1 !border-0 !bg-transparent"
      />
    </div>
  );
}
