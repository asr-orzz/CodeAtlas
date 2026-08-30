import type { ArchitectureGraph } from "../types";

interface Props {
  ir: ArchitectureGraph;
  nodeId: string;
  onClose: () => void;
}

export function DetailPanel({ ir, nodeId, onClose }: Props) {
  const node = ir.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const nameById = new Map(ir.nodes.map((n) => [n.id, n.name]));
  const outgoing = ir.edges.filter((e) => e.source === nodeId);
  const incoming = ir.edges.filter((e) => e.target === nodeId);

  return (
    <div className="absolute right-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-72 flex-col rounded-xl border border-surface-border bg-surface-raised/95 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between border-b border-surface-border px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-100">{node.name}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">{node.kind}</div>
        </div>
        <button
          onClick={onClose}
          className="ml-2 rounded p-1 text-slate-500 hover:text-slate-200"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs">
        {node.filePath && (
          <div className="break-all font-mono text-[11px] text-slate-500">
            {node.filePath}
            {node.location ? `:${node.location.line}` : ""}
          </div>
        )}

        {node.data?.properties && node.data.properties.length > 0 && (
          <Section title="Properties">
            {node.data.properties.map((p, i) => (
              <div key={i} className="font-mono text-slate-400">
                {p.name}
                {p.type ? `: ${p.type}` : ""}
              </div>
            ))}
          </Section>
        )}

        {node.data?.methods && node.data.methods.length > 0 && (
          <Section title="Methods">
            {node.data.methods.map((m, i) => (
              <div key={i} className="font-mono text-slate-300">
                {m.name}()
              </div>
            ))}
          </Section>
        )}

        <RelationList
          title={`Depends on / calls (${outgoing.length})`}
          items={outgoing.map((e) => `${e.kind} → ${nameById.get(e.target) ?? e.target}`)}
        />
        <RelationList
          title={`Used by (${incoming.length})`}
          items={incoming.map((e) => `${nameById.get(e.source) ?? e.source} → ${e.kind}`)}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function RelationList({ title, items }: { title: string; items: string[] }) {
  return (
    <Section title={title}>
      {items.length === 0 ? (
        <div className="text-slate-600">None</div>
      ) : (
        items.map((item, i) => (
          <div key={i} className="truncate text-slate-400">
            {item}
          </div>
        ))
      )}
    </Section>
  );
}
