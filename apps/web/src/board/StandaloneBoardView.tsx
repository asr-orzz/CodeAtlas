import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Board } from "../types";
import { BoardEditor } from "./BoardEditor";

interface Props {
  boardId: string;
  onDeleted: () => void;
}

export function StandaloneBoardView({ boardId, onDeleted }: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setError(null);
    api
      .getBoard(boardId)
      .then((b) => {
        if (!cancelled) setBoard(b);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteBoard(boardId);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-white">
            {board?.name ?? "Board"}
          </h2>
          <p className="truncate text-xs text-slate-500">
            Blank board · design UML by hand
          </p>
        </div>
        <button
          onClick={remove}
          disabled={busy || !board}
          className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
        >
          Delete board
        </button>
      </header>

      {error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {board ? (
          <BoardEditor board={board} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {error ? "Could not load board." : "Loading board…"}
          </div>
        )}
      </div>
    </div>
  );
}
