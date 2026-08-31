import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

type Tab = "login" | "register";

export function AuthPanel({ initialTab = "register" }: { initialTab?: Tab }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (tab === "login") await login(email.trim(), password);
      else await register(email.trim(), password, name.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-strong w-full max-w-md rounded-3xl p-8 shadow-glow-lg">
      <div className="mb-6 flex rounded-2xl border border-white/10 bg-white/5 p-1">
        {(["register", "login"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${
              tab === t
                ? "bg-gradient-to-r from-accent to-accent-soft text-white shadow-glow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t === "register" ? "Sign up" : "Sign in"}
          </button>
        ))}
      </div>

      <h2 className="text-2xl font-bold text-white">
        {tab === "register" ? "Create your account" : "Welcome back"}
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        {tab === "register"
          ? "Start mapping your codebase in seconds."
          : "Sign in to continue exploring your architecture."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {tab === "register" && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              className="input"
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="input"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tab === "register" ? "At least 8 characters" : "••••••••"}
            className="input"
            autoComplete={tab === "register" ? "new-password" : "current-password"}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy
            ? "Please wait…"
            : tab === "register"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-slate-500">
        {tab === "register" ? "Already have an account? " : "New to CodeAtlas? "}
        <button
          type="button"
          onClick={() => setTab(tab === "register" ? "login" : "register")}
          className="font-semibold text-accent-soft hover:underline"
        >
          {tab === "register" ? "Sign in" : "Create one"}
        </button>
      </p>
    </div>
  );
}
