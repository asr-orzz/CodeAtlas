import { useState } from "react";
import { api } from "../api/client";
import type { ImportResult } from "../types";

interface Props {
  onAnalyzed: (result: ImportResult) => void;
}

export function AnalyzeForm({ onAnalyzed }: Props) {
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
      const result = await api.analyzeGithub(value.trim(), branch.trim() || undefined);
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
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Analyze a GitHub repo
      </p>

      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="owner/repo or https://github.com/owner/repo"
        className="input"
      />

      <input
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
        placeholder="branch (optional)"
        className="input"
      />

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
