import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { BoardView } from "../board/BoardView";
import { AiPanel } from "../components/AiPanel";
import { AnalyzeForm } from "../components/AnalyzeForm";
import { DetailPanel } from "../components/DetailPanel";
import { DiagramView, type DiagramRequest } from "../components/DiagramView";
import { Wordmark } from "../components/Logo";
import { ProjectList } from "../components/ProjectList";
import { ReportPanel } from "../components/ReportPanel";
import type { CanvasAction, ProjectDetail, ProjectSummary } from "../types";

type Mode = "explore" | "board";

export function Dashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("explore");
  const [showAi, setShowAi] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [diagramRequest, setDiagramRequest] = useState<DiagramRequest | undefined>(undefined);

  const handleCanvasAction = useCallback((action: CanvasAction) => {
    switch (action.type) {
      case "focusNode":
      case "highlightNodes":
        setSelectedNodeId("nodeId" in action ? action.nodeId : (action.nodeIds[0] ?? null));
        break;
      case "showDiagram":
        setDiagramRequest((r) => ({ kind: action.kind, nonce: (r?.nonce ?? 0) + 1 }));
        break;
      case "generateSequence":
        setDiagramRequest((r) => ({
          kind: "sequence",
          entryId: action.entryId,
          nonce: (r?.nonce ?? 0) + 1,
        }));
        break;
    }
  }, []);

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
    setDiagramRequest(undefined);
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
    <div className="flex h-screen overflow-hidden bg-surface">
      <aside className="glass-strong flex w-80 shrink-0 flex-col border-r border-white/5">
        <div className="border-b border-white/5 px-5 py-5">
          <Wordmark />
          <p className="mt-2 text-[11px] text-slate-500">
            code → graph → diagrams → AI
          </p>
        </div>
        <div className="border-b border-white/5 p-4">
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
        <UserMenu
          email={user?.email ?? ""}
          name={user?.name ?? ""}
          open={menuOpen}
          onToggle={() => setMenuOpen((v) => !v)}
          onLogout={logout}
        />
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
            <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-white">
                  {detail.name}
                </h2>
                <p className="truncate text-xs text-slate-500">{detail.source}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {mode === "explore" && (
                  <button
                    onClick={() => setShowAi((v) => !v)}
                    className={`rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium transition ${
                      showAi ? "bg-accent/20 text-accent-soft" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    AI assistant
                  </button>
                )}
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-0.5">
                  {(["explore", "board"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                        mode === m
                          ? "bg-gradient-to-r from-accent to-accent-soft text-white shadow-glow"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </header>
            {mode === "explore" ? (
              <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
                <div className="shrink-0">
                  <ReportPanel project={detail} />
                </div>
                <div className="flex min-h-0 flex-1 gap-4">
                  <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-surface-raised/50">
                    <DiagramView
                      projectId={detail.id}
                      onSelectNode={setSelectedNodeId}
                      request={diagramRequest}
                    />
                    {selectedNodeId && (
                      <DetailPanel
                        ir={detail.ir}
                        nodeId={selectedNodeId}
                        onClose={() => setSelectedNodeId(null)}
                      />
                    )}
                  </div>
                  {showAi && (
                    <AiPanel
                      projectId={detail.id}
                      onFocusNode={setSelectedNodeId}
                      onCanvasAction={handleCanvasAction}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1">
                <BoardView projectId={detail.id} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function UserMenu({
  email,
  name,
  open,
  onToggle,
  onLogout,
}: {
  email: string;
  name: string;
  open: boolean;
  onToggle: () => void;
  onLogout: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initial = (name || email || "?").charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onToggle]);

  return (
    <div ref={ref} className="relative border-t border-white/5 p-3">
      {open && (
        <div className="absolute bottom-16 left-3 right-3 z-10 overflow-hidden rounded-xl border border-white/10 bg-surface-raised shadow-glow">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-white/5"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M13 7V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2M9 10h8m0 0-3-3m3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </div>
      )}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-soft text-sm font-bold text-white">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-200">
            {name || "Account"}
          </span>
          <span className="block truncate text-xs text-slate-500">{email}</span>
        </span>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-500">
          <path d="M10 3a1 1 0 0 1 1 1v9.6l3.3-3.3a1 1 0 0 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4L9 13.6V4a1 1 0 0 1 1-1z" />
        </svg>
      </button>
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
    <div className="aurora flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-md animate-fade-up">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-soft text-3xl shadow-glow-lg">
          🧭
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white">
          {loading ? "Loading…" : "Explore a codebase"}
        </h2>
        <p className="text-slate-400">
          {hasProjects
            ? "Select a project on the left to see its architecture report, graphs and diagrams."
            : "Analyze a GitHub repository or a local folder to build its fact-based architecture graph."}
        </p>
      </div>
    </div>
  );
}
