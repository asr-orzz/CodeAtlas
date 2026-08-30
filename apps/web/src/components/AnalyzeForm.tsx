import { useState } from "react";
import { api } from "../api/client";
import type { ImportResult } from "../types";

interface Props {
  onAnalyzed: (result: ImportResult) => void;
}

type Mode = "local" | "github";

export function AnalyzeForm({ onAnalyzed }: Props) {
  const [mode, setMode] = useState<Mode>("github");
  const [value, setValue] = useState("");
  const [branch, setBranch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "github"
          ? await api.analyzeGithub(value.trim(), branch.trim() || undefined)
          : await api.analyzePath(value.trim());
      onAnalyzed(result);
      setValue("");
      setBranch("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-surface p-1">
        {(["github", "local"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === m
                ? "bg-accent text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {m === "github" ? "GitHub repo" : "Local path"}
          </button>
        ))}
      </div>

      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          mode === "github" ? "owner/repo or https://github.com/owner/repo" : "C:\\path\\to\\project"
        }
        className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {mode === "github" && (
        <input
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="branch (optional)"
          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      )}

      <button
        type="submit"
        disabled={busy || !value.trim()}
        className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Analyzing…" : "Analyze"}
      </button>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
