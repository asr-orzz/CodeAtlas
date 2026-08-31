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
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {(["github", "local"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              mode === m
                ? "bg-gradient-to-r from-accent to-accent-soft text-white shadow-glow"
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
        className="input"
      />

      {mode === "github" && (
        <input
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="branch (optional)"
          className="input"
        />
      )}

      <button
        type="submit"
        disabled={busy || !value.trim()}
        className="btn-primary w-full"
      >
        {busy ? "Analyzing…" : "Analyze repository"}
      </button>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
