import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Board, BoardSummary, DiagramKind } from "../types";
import { BoardEditor } from "./BoardEditor";

interface Props {
  projectId: string;
}

export function BoardView({ projectId }: Props) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [active, setActive] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { boards } = await api.listBoards(projectId);
    setBoards(boards);
    return boards;
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setActive(null);
    setError(null);
    refresh()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        return api.getBoard(list[0]!.id).then((b) => {
          if (!cancelled) setActive(b);
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refresh]);

  const openBoard = useCallback(async (id: string) => {
    try {
      setActive(await api.getBoard(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const create = useCallback(
    async (seedKind?: DiagramKind) => {
      setBusy(true);
      setError(null);
      try {
        const name = seedKind ? `${seedKind} board` : "Untitled board";
        const board = await api.createBoard(projectId, name, seedKind);
        setActive(board);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [projectId, refresh],
  );

  const remove = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    try {
      await api.deleteBoard(active.id);
      const list = await refresh();
      if (list.length > 0) await openBoard(list[0]!.id);
      else setActive(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [active, refresh, openBoard]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-surface-border px-3 py-2">
        <select
          value={active?.id ?? ""}
          onChange={(e) => e.target.value && openBoard(e.target.value)}
          className="rounded-md border border-surface-border bg-surface px-2 py-1 text-xs text-slate-200"
        >
          {boards.length === 0 && <option value="">No boards yet</option>}
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.nodeCount})
            </option>
          ))}
        </select>
        <button
          onClick={() => create()}
          disabled={busy}
          className="rounded-md border border-surface-border px-3 py-1 text-xs text-slate-300 hover:bg-surface disabled:opacity-50"
        >
          New blank
        </button>
        <button
          onClick={() => create("class")}
          disabled={busy}
          className="rounded-md border border-surface-border px-3 py-1 text-xs text-slate-300 hover:bg-surface disabled:opacity-50"
        >
          New from class diagram
        </button>
        <button
          onClick={() => create("component")}
          disabled={busy}
          className="rounded-md border border-surface-border px-3 py-1 text-xs text-slate-300 hover:bg-surface disabled:opacity-50"
        >
          New from component diagram
        </button>
        {active && (
          <button
            onClick={remove}
            disabled={busy}
            className="ml-auto rounded-md border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            Delete board
          </button>
        )}
      </div>

      {error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {active ? (
          <BoardEditor board={active} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Create a board to start designing manually.
          </div>
        )}
      </div>
    </div>
  );
}
