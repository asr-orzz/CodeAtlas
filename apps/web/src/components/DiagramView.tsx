import { useEffect, useState } from "react";
import { api } from "../api/client";
import { DiagramCanvas } from "../canvas/DiagramCanvas";
import { SequenceCanvas } from "../canvas/SequenceCanvas";
import type { DiagramKind, DiagramModel } from "../types";

export interface DiagramRequest {
  kind: DiagramKind;
  entryId?: string;
  /** Bump to re-apply the same request. */
  nonce: number;
}

interface Props {
  projectId: string;
  onSelectNode?: (id: string | null) => void;
  request?: DiagramRequest;
}

const TABS: Array<{ kind: DiagramKind; label: string }> = [
  { kind: "class", label: "Class" },
  { kind: "component", label: "Component" },
  { kind: "sequence", label: "Sequence" },
  { kind: "dependency", label: "Dependency graph" },
  { kind: "call", label: "Call graph" },
];

export function DiagramView({ projectId, onSelectNode, request }: Props) {
  const [kind, setKind] = useState<DiagramKind>("class");
  const [entryId, setEntryId] = useState<string | undefined>(undefined);
  const [model, setModel] = useState<DiagramModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Apply an external request (e.g. from the AI assistant) to drive the view.
  useEffect(() => {
    if (!request) return;
    setKind(request.kind);
    setEntryId(request.kind === "sequence" ? request.entryId : undefined);
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getDiagram(projectId, kind, kind === "sequence" ? entryId : undefined)
      .then((m) => {
        if (!cancelled) setModel(m);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, kind, entryId]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 border-b border-surface-border bg-surface-raised px-2 py-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            onClick={() => {
              setKind(tab.kind);
              setEntryId(undefined);
              onSelectNode?.(null);
            }}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              kind === tab.kind
                ? "bg-accent text-white"
                : "text-slate-400 hover:bg-surface hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <Centered>Generating {kind} diagram…</Centered>
        ) : error ? (
          <Centered className="text-red-300">{error}</Centered>
        ) : !model || model.nodes.length === 0 ? (
          <Centered>{model?.notes?.[0] ?? "Nothing to display."}</Centered>
        ) : model.kind === "sequence" ? (
          <SequenceCanvas model={model} />
        ) : (
          <DiagramCanvas model={model} onSelectNode={onSelectNode} />
        )}
      </div>
    </div>
  );
}

function Centered({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex h-full items-center justify-center text-sm text-slate-500 ${className ?? ""}`}>
      {children}
    </div>
  );
}
