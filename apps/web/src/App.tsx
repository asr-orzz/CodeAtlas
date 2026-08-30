import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import { AnalyzeForm } from "./components/AnalyzeForm";
import { DetailPanel } from "./components/DetailPanel";
import { DiagramView } from "./components/DiagramView";
import { ProjectList } from "./components/ProjectList";
import { ReportPanel } from "./components/ReportPanel";
import type { ProjectDetail, ProjectSummary } from "./types";

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    try {
      const { projects: list } = await api.listProjects();
      setProjects(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    setSelectedNodeId(null);
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    api
      .getProject(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function handleDelete(id: string) {
    try {
      await api.deleteProject(id);
      if (selectedId === id) setSelectedId(null);
      await refreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-80 shrink-0 flex-col border-r border-surface-border bg-surface-raised">
        <div className="border-b border-surface-border px-4 py-4">
          <h1 className="text-sm font-bold text-slate-100">
            Architecture Explorer
          </h1>
          <p className="text-[11px] text-slate-500">
            code → graph → diagrams → AI
          </p>
        </div>
        <div className="border-b border-surface-border p-4">
          <AnalyzeForm
            onAnalyzed={async (result) => {
              await refreshProjects();
              setSelectedId(result.id);
            }}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ProjectList
            projects={projects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={handleDelete}
          />
        </div>
        <div className="border-t border-surface-border px-4 py-2 text-[10px] text-slate-600">
          API: {api.baseUrl}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {error && (
          <div className="border-b border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {!detail ? (
          <EmptyState loading={loadingDetail} hasProjects={projects.length > 0} />
        ) : (
          <>
            <header className="flex items-center justify-between border-b border-surface-border px-6 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-100">
                  {detail.name}
                </h2>
                <p className="truncate text-xs text-slate-500">{detail.source}</p>
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
              <div className="shrink-0">
                <ReportPanel project={detail} />
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-surface-border bg-surface">
                <DiagramView projectId={detail.id} onSelectNode={setSelectedNodeId} />
                {selectedNodeId && (
                  <DetailPanel
                    ir={detail.ir}
                    nodeId={selectedNodeId}
                    onClose={() => setSelectedNodeId(null)}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({
  loading,
  hasProjects,
}: {
  loading: boolean;
  hasProjects: boolean;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <div className="mb-3 text-4xl">🧭</div>
        <h2 className="mb-1 text-lg font-semibold text-slate-200">
          {loading ? "Loading…" : "Explore a codebase"}
        </h2>
        <p className="text-sm text-slate-500">
          {hasProjects
            ? "Select a project on the left to see its architecture report."
            : "Analyze a GitHub repository or a local folder to build its fact-based architecture graph."}
        </p>
      </div>
    </div>
  );
}
