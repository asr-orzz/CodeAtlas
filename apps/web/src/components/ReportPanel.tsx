import type { ProjectDetail } from "../types";

interface Props {
  project: ProjectDetail;
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface px-3 py-2">
      <div className={`text-lg font-semibold ${accent ?? "text-slate-100"}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

export function ReportPanel({ project }: Props) {
  const { report } = project;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Nodes" value={report.nodeCount} />
        <Stat label="Edges" value={report.edgeCount} />
        <Stat
          label="Cycles"
          value={report.cycles.length}
          accent={report.cycles.length > 0 ? "text-amber-400" : "text-emerald-400"}
        />
        <Stat
          label="Layered"
          value={report.isLayered ? "Yes" : "No"}
          accent={report.isLayered ? "text-emerald-400" : "text-amber-400"}
        />
      </div>

      {report.cycles.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
            Dependency cycles
          </h4>
          <ul className="space-y-1 text-xs text-amber-200/80">
            {report.cycles.map((cycle, i) => (
              <li key={i} className="font-mono">
                {cycle.names.join(" → ")} → {cycle.names[0]}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <RankedList title="Most depended upon" items={report.mostDependedUpon} />
        <RankedList title="Most dependencies" items={report.mostDependencies} />
      </div>
    </div>
  );
}

function RankedList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; name: string; count: number }>;
}) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">None</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span className="truncate text-slate-200">{item.name}</span>
              <span className="ml-2 shrink-0 font-mono text-slate-500">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
