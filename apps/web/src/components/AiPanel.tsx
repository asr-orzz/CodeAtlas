import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AiAnswer, Smell } from "../types";

interface Props {
  projectId: string;
  onFocusNode?: (id: string) => void;
}

type Tab = "explain" | "smells" | "ask";

const SEVERITY_STYLE: Record<Smell["severity"], string> = {
  error: "border-red-500/40 bg-red-500/10 text-red-200",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-200",
};

export function AiPanel({ projectId, onFocusNode }: Props) {
  const [tab, setTab] = useState<Tab>("explain");
  const [explain, setExplain] = useState<string>("");
  const [smells, setSmells] = useState<Smell[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAnswer(null);
    Promise.all([api.aiExplain(projectId), api.aiSmells(projectId)])
      .then(([e, s]) => {
        if (cancelled) return;
        setExplain(e.text);
        setSmells(s.smells);
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

  async function ask() {
    if (!question.trim()) return;
    setAsking(true);
    try {
      setAnswer(await api.aiAsk(projectId, question));
    } catch (err) {
      setAnswer({ answer: err instanceof Error ? err.message : String(err), source: "deterministic" });
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex h-full w-96 shrink-0 flex-col rounded-xl border border-surface-border bg-surface-raised">
      <div className="flex shrink-0 items-center gap-1 border-b border-surface-border px-2 py-2">
        <span className="mr-auto pl-1 text-sm font-semibold text-slate-100">AI assistant</span>
        {(["explain", "smells", "ask"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
              tab === t ? "bg-accent text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && <div className="text-xs text-red-300">{error}</div>}

        {tab === "explain" && (
          loading ? <Loading /> : <MarkdownLite text={explain} />
        )}

        {tab === "smells" &&
          (loading ? (
            <Loading />
          ) : !smells || smells.length === 0 ? (
            <div className="text-sm text-slate-500">No structural smells detected. 👍</div>
          ) : (
            <div className="space-y-2">
              {smells.map((s) => (
                <button
                  key={s.id}
                  onClick={() => s.nodes[0] && onFocusNode?.(s.nodes[0])}
                  className={`block w-full rounded-lg border px-3 py-2 text-left ${SEVERITY_STYLE[s.severity]}`}
                >
                  <div className="text-xs font-semibold">{s.title}</div>
                  <div className="mt-0.5 text-[11px] opacity-80">{s.detail}</div>
                </button>
              ))}
            </div>
          ))}

        {tab === "ask" && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500">
              Ask about the architecture, cycles, smells or the most important types.
            </p>
            {answer && (
              <div className="rounded-lg border border-surface-border bg-surface p-3">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                  {answer.source === "provider" ? "AI provider" : "Deterministic engine"}
                </div>
                <MarkdownLite text={answer.answer} />
              </div>
            )}
          </div>
        )}
      </div>

      {tab === "ask" && (
        <div className="shrink-0 border-t border-surface-border p-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void ask();
            }}
            rows={2}
            placeholder="e.g. Are there circular dependencies?"
            className="w-full resize-none rounded-md border border-surface-border bg-surface px-2 py-1.5 text-xs text-slate-100"
          />
          <button
            onClick={() => void ask()}
            disabled={asking || !question.trim()}
            className="mt-2 w-full rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {asking ? "Thinking…" : "Ask (⌘/Ctrl+Enter)"}
          </button>
        </div>
      )}
    </div>
  );
}

function Loading() {
  return <div className="text-sm text-slate-500">Analyzing…</div>;
}

/** Minimal Markdown renderer: headings, bold, and bullet lists. */
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm text-slate-300">
      {lines.map((line, i) => {
        if (line.startsWith("### "))
          return <h4 key={i} className="pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">{inline(line.slice(4))}</h4>;
        if (line.startsWith("## "))
          return <h3 key={i} className="pt-1 text-sm font-bold text-slate-100">{inline(line.slice(3))}</h3>;
        if (line.startsWith("- "))
          return <div key={i} className="pl-3 text-slate-300">• {inline(line.slice(2))}</div>;
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}

/** Render **bold** spans within a line. */
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-slate-100">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}
