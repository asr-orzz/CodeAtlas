import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { BoardView } from "../board/BoardView";
import { StandaloneBoardView } from "../board/StandaloneBoardView";
import { AiPanel } from "../components/AiPanel";
import { AnalyzeForm } from "../components/AnalyzeForm";
import { DetailPanel } from "../components/DetailPanel";
import { DiagramView, type DiagramRequest } from "../components/DiagramView";
import { Wordmark } from "../components/Logo";
import { ProjectList } from "../components/ProjectList";
import { ReportPanel } from "../components/ReportPanel";
import type {
  BoardSummary,
  CanvasAction,
  ProjectDetail,
  ProjectSummary,
} from "../types";

type Mode = "explore" | "board";

export function Dashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("explore");
  const [showAi, setShowAi] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);
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

  const refreshBoards = useCallback(async () => {
    try {
      const { boards: list } = await api.listStandaloneBoards();
      setBoards(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
    void refreshBoards();
  }, [refreshProjects, refreshBoards]);

  const selectProject = useCallback((id: string) => {
    setActiveBoardId(null);
    setSelectedId(id);
  }, []);

  const openBoard = useCallback((id: string) => {
    setSelectedId(null);
    setDetail(null);
    setActiveBoardId(id);
  }, []);

  const createBlankBoard = useCallback(async () => {
    if (creatingBoard) return;
    setCreatingBoard(true);
    setError(null);
    try {
      const board = await api.createStandaloneBoard("Untitled board");
      await refreshBoards();
      openBoard(board.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingBoard(false);
    }
  }, [creatingBoard, openBoard, refreshBoards]);

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
              selectProject(result.id);
            }}
          />
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-3">
          <section>
            <SectionHeader label="Repositories" count={projects.length} />
            <ProjectList
              projects={projects}
              selectedId={selectedId}
              onSelect={selectProject}
              onDelete={handleDelete}
            />
          </section>

          <section>
            <SectionHeader
              label="My boards"
              count={boards.length}
              action={
                <button
                  onClick={createBlankBoard}
                  disabled={creatingBoard}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                >
                  <PlusIcon /> New
                </button>
              }
            />
            {boards.length === 0 ? (
              <p className="px-1 text-xs text-slate-600">
                Create a blank board to draw UML by hand.
              </p>
            ) : (
              <ul className="space-y-1">
                {boards.map((b) => (
                  <li key={b.id}>
                    <button
                      onClick={() => openBoard(b.id)}
                      className={`group flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                        activeBoardId === b.id
                          ? "border-accent/60 bg-accent/10 text-white"
                          : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <BoardIcon
                        className={
                          activeBoardId === b.id ? "text-accent-soft" : "text-slate-500"
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{b.name}</span>
                      <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {b.nodeCount}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
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

        {activeBoardId ? (
          <StandaloneBoardView
            key={activeBoardId}
            boardId={activeBoardId}
            onDeleted={async () => {
              setActiveBoardId(null);
              await refreshBoards();
            }}
          />
        ) : !detail ? (
          <EmptyState
            loading={loadingDetail}
            hasProjects={projects.length > 0}
            onCreateBoard={createBlankBoard}
            creatingBoard={creatingBoard}
          />
        ) : (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-surface-raised/30 px-6 py-4 backdrop-blur-xl">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                  <span>Repositories</span>
                  <span className="text-slate-700">/</span>
                  <span className="truncate text-slate-400">{detail.name}</span>
                </div>
                <h2 className="mt-0.5 flex items-center gap-2 truncate text-lg font-semibold text-white">
                  {detail.name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatBadge label="nodes" value={detail.ir.nodes.length} />
                  <StatBadge label="edges" value={detail.ir.edges.length} />
                  {detail.source && (
                    <span className="max-w-[22rem] truncate rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">
                      {detail.source}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {mode === "explore" && (
                  <button
                    onClick={() => setShowAi((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium transition ${
                      showAi ? "bg-accent/20 text-accent-soft" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <SparkleIcon /> AI assistant
                  </button>
                )}
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-0.5">
                  {(
                    [
                      ["explore", "Explore"],
                      ["board", "Board"],
                    ] as [Mode, string][]
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        mode === m
                          ? "bg-gradient-to-r from-accent to-accent-soft text-white shadow-glow"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {m === "explore" ? <GraphIcon /> : <BoardIcon />}
                      {label}
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
  onCreateBoard,
  creatingBoard,
}: {
  loading: boolean;
  hasProjects: boolean;
  onCreateBoard: () => void;
  creatingBoard: boolean;
}) {
  return (
    <div className="aurora flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-2xl animate-fade-up text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-soft text-3xl shadow-glow-lg">
          🧭
        </div>
        <h2 className="mb-2 text-2xl font-bold text-white">
          {loading
            ? "Loading…"
            : hasProjects
              ? "Pick up where you left off"
              : "Map your architecture"}
        </h2>
        <p className="mx-auto max-w-md text-slate-400">
          {hasProjects
            ? "Select a repository on the left to see its report, graphs and diagrams — or start a fresh board."
            : "Turn a GitHub repository into a fact-based architecture graph, or design UML by hand on a blank board."}
        </p>

        <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
          <div className="glass rounded-2xl p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-accent-soft">
              <GraphIcon />
            </div>
            <h3 className="text-sm font-semibold text-white">Analyze a repository</h3>
            <p className="mt-1 text-xs text-slate-400">
              Paste a GitHub URL in the panel on the left to generate dependency,
              class and sequence diagrams automatically.
            </p>
          </div>

          <button
            onClick={onCreateBoard}
            disabled={creatingBoard}
            className="glass group rounded-2xl p-5 text-left transition hover:border-accent/40 hover:bg-white/[0.06] disabled:opacity-60"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-soft text-white shadow-glow">
              <PlusIcon />
            </div>
            <h3 className="text-sm font-semibold text-white">
              {creatingBoard ? "Creating board…" : "Create a blank board"}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Start with an empty canvas and design class, component or ER diagrams
              by hand.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  count,
  action,
}: {
  label: string;
  count: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
        <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {count}
        </span>
      </span>
      {action}
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
      <span className="font-semibold text-slate-200">{value}</span>
      {label}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}

function BoardIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={`h-3.5 w-3.5 ${className}`}>
      <rect x="2.5" y="4" width="15" height="12" rx="1.5" />
      <path d="M2.5 8h15M8 8v8" strokeLinecap="round" />
    </svg>
  );
}

function GraphIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5">
      <circle cx="5" cy="6" r="2" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="10" cy="15" r="2" />
      <path d="M6.5 7.3 8.8 13M13.5 7.3 11.2 13M7 6h6" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M10 1.5c.3 2.9 1.6 4.2 4.5 4.5-2.9.3-4.2 1.6-4.5 4.5-.3-2.9-1.6-4.2-4.5-4.5 2.9-.3 4.2-1.6 4.5-4.5zM15.5 11c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z" />
    </svg>
  );
}
