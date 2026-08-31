import { useRef } from "react";
import { Wordmark } from "../components/Logo";
import { AuthPanel } from "./AuthPanel";

export function Landing() {
  const authRef = useRef<HTMLDivElement>(null);
  const scrollToAuth = () =>
    authRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="aurora min-h-screen bg-surface text-slate-200">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-white/5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Wordmark />
          <div className="flex items-center gap-3">
            <a
              href="#features"
              className="hidden text-sm font-medium text-slate-400 transition hover:text-slate-200 sm:block"
            >
              Features
            </a>
            <a
              href="#how"
              className="hidden text-sm font-medium text-slate-400 transition hover:text-slate-200 sm:block"
            >
              How it works
            </a>
            <button onClick={scrollToAuth} className="btn-primary px-4 py-2">
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-accent-soft">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-soft" />
              Static analysis · not guesswork
            </span>
            <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl">
              See your codebase's
              <span className="block text-gradient">true architecture.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
              Point CodeAtlas at any GitHub repo. It parses the real code into
              dependency &amp; call graphs, auto-draws UML and sequence diagrams,
              and gives you an AI assistant that actually understands the
              structure — not a hallucinated summary.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button onClick={scrollToAuth} className="btn-primary px-6 py-3 text-base">
                Analyze a repo — free
              </button>
              <a href="#how" className="btn-ghost px-6 py-3 text-base">
                See how it works
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-500">
              {[
                "No code execution — parse only",
                "TypeScript & JavaScript",
                "Deterministic graphs",
              ].map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <CheckIcon /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Auth card + floating mock */}
          <div ref={authRef} className="relative flex justify-center lg:justify-end">
            <FloatingMock />
            <div className="relative z-10 w-full max-w-md">
              <AuthPanel />
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeading
          eyebrow="How it works"
          title="From repository to understanding"
          subtitle="A fact-first pipeline: we extract what's really in the code, then use algorithms and AI to interpret it."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-4">
          {PIPELINE.map((step, i) => (
            <Step key={step.title} index={i + 1} {...step} last={i === PIPELINE.length - 1} />
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to reason about a codebase"
          subtitle="Built as one product: analysis, visualization, an editable board, and an AI that knows the graph."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="glass relative overflow-hidden rounded-3xl p-10 text-center shadow-glow-lg sm:p-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
          <h2 className="text-3xl font-black text-white sm:text-4xl">
            Map your first repo in under a minute.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            Create a free account, paste a GitHub URL, and watch your
            architecture come to life.
          </p>
          <button onClick={scrollToAuth} className="btn-primary mx-auto mt-8 px-8 py-3.5 text-base">
            Get started for free
          </button>
        </div>
      </section>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <Wordmark />
          <p>code → graph → diagrams → AI</p>
        </div>
      </footer>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-accent-soft">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent-soft">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-slate-400">{subtitle}</p>
    </div>
  );
}

function FloatingMock() {
  const cards = [
    { label: "UserController", tone: "from-indigo-500/30", pos: "left-0 top-4", delay: "0s" },
    { label: "UserService", tone: "from-sky-500/30", pos: "left-24 top-40", delay: "1.2s" },
    { label: "Database", tone: "from-fuchsia-500/30", pos: "left-8 bottom-2", delay: "2.4s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`absolute ${c.pos} animate-float`}
          style={{ animationDelay: c.delay }}
        >
          <div
            className={`glass rounded-2xl bg-gradient-to-br ${c.tone} to-transparent px-4 py-3 shadow-glow`}
          >
            <div className="font-mono text-xs text-white">{c.label}</div>
            <div className="mt-1 h-1 w-16 rounded-full bg-white/20" />
            <div className="mt-1 h-1 w-10 rounded-full bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Step({
  index,
  title,
  detail,
  last,
}: {
  index: number;
  title: string;
  detail: string;
  last: boolean;
}) {
  return (
    <div className="relative glass rounded-2xl p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-soft font-bold text-white shadow-glow">
        {index}
      </div>
      <h3 className="mt-4 font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-400">{detail}</p>
      {!last && (
        <div className="absolute -right-2 top-11 hidden text-accent-soft/50 md:block">
          →
        </div>
      )}
    </div>
  );
}

function FeatureCard({
  title,
  detail,
  icon,
}: {
  title: string;
  detail: string;
  icon: string;
}) {
  return (
    <div className="group glass rounded-2xl p-6 transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-glow">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-2xl transition group-hover:scale-110">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{detail}</p>
    </div>
  );
}

const PIPELINE = [
  { title: "Import", detail: "Paste a GitHub URL or a local path. We shallow-clone and read — never run — your code." },
  { title: "Analyze", detail: "A ts-morph parser extracts classes, types, imports, and call sites into facts." },
  { title: "Graph", detail: "Facts become dependency, call, and architecture graphs with cycle detection." },
  { title: "Understand", detail: "Auto UML & sequence diagrams, plus an AI that explains and answers questions." },
];

const FEATURES = [
  {
    icon: "🕸️",
    title: "Dependency & call graphs",
    detail: "Two distinct graphs — who depends on whom vs. who calls whom — with transitive queries and cycle detection.",
  },
  {
    icon: "📐",
    title: "Automatic UML",
    detail: "Class, component and sequence diagrams laid out with deterministic algorithms — no hand-placing nodes.",
  },
  {
    icon: "🧠",
    title: "AI that knows the graph",
    detail: "Ask 'what does UserService depend on?' or 'trace the login flow'. It reasons over real structure, with a free Grok model.",
  },
  {
    icon: "🎨",
    title: "Editable board",
    detail: "Seed a board from any diagram, then drag nodes and draw typed relationships to design new architecture.",
  },
  {
    icon: "🔎",
    title: "Code ↔ diagram",
    detail: "Every node links back to its file and line, so you move from a picture to the source instantly.",
  },
  {
    icon: "🔒",
    title: "Safe by design",
    detail: "Repositories are only parsed, never executed. Your projects are private to your account.",
  },
];
