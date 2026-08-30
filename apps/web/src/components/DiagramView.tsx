import { useEffect, useState } from "react";
import { api } from "../api/client";
import { DiagramCanvas } from "../canvas/DiagramCanvas";
import type { DiagramModel } from "../types";

interface Props {
  projectId: string;
}

export function DiagramView({ projectId }: Props) {
  const [model, setModel] = useState<DiagramModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getDiagram(projectId, "class")
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
  }, [projectId]);

  if (loading) {
    return <Centered>Generating class diagram…</Centered>;
  }
  if (error) {
    return <Centered className="text-red-300">{error}</Centered>;
  }
  if (!model || model.nodes.length === 0) {
    return (
      <Centered>{model?.notes?.[0] ?? "Nothing to display for this project."}</Centered>
    );
  }

  return <DiagramCanvas model={model} />;
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
