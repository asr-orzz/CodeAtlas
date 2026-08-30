# AI Software Architecture Explorer

Turn a codebase into a **fact-based architecture model**, then visualize, explore, edit and reason about it.

```
GitHub repo / local folder
        │
        ▼
  Static analysis (AST)          ← deterministic, never an LLM
        │
        ▼
  Dependency graph + Call graph
        │
        ▼
  Architecture IR                ← the single source of truth
        │
   ┌────┼──────────┐
   ▼    ▼          ▼
 Class  Component  Sequence      ← automatically generated UML
        │
        ▼
  Interactive canvas (React Flow)
        │
        ▼
  AI assistant                   ← reasons *about* the graph, doesn't invent it
```

The guiding principle: the system first builds a **fact-based representation** of the
code, and only then uses deterministic graph algorithms and AI to interpret and
visualize it. The AI never invents dependencies — it explains and manipulates a
graph that static analysis already proved.

## Repository layout

```
packages/
  core/       @archx/core      — the Architecture IR + shared domain types
  graph/      @archx/graph      — graph engine + algorithms (cycles, paths, topo sort)
  analyzer/   @archx/analyzer   — ts-morph static analysis for TS/JS
  diagram/    @archx/diagram    — dagre layout + class/component/sequence generation
apps/
  api/        @archx/api        — Express API (analyze repos, serve IR & diagrams, AI)
  web/        @archx/web         — Vite + React + Tailwind + React Flow canvas
```

## Tech stack

Chosen so the project **runs after a single `npm install`**, with no external
database, message queue, or Docker required:

- TypeScript everywhere, npm workspaces monorepo
- [`ts-morph`](https://ts-morph.com/) for AST parsing (pure JS, no native builds)
- Hand-written graph algorithms
- [`dagre`](https://github.com/dagrejs/dagre) for hierarchical layout
- Express API, JSON-file storage
- Vite + React + Tailwind CSS + React Flow for the interactive canvas
- Pluggable AI layer with a **deterministic fallback**, so it works without an API key

## Getting started

```bash
npm install
# terminal 1
npm run api
# terminal 2
npm run web
```

> This is an MVP that captures the core technical story. Multiplayer (Yjs),
> Postgres/Redis, GitHub OAuth and PR bots from the extended vision are intentionally
> out of scope for the first working version.

## Development

```bash
npm run typecheck   # type-check every package
npm test            # run unit tests (graph algorithms, analyzer, etc.)
```

## Troubleshooting

**`npm install` fails with `ERR_INVALID_ARG_TYPE: The "file" argument must be of type string`.**
This happens when the `ComSpec` environment variable is empty, so npm cannot spawn
package postinstall scripts (e.g. `esbuild`). Set it before installing:

```powershell
# PowerShell
$env:ComSpec = "C:\Windows\System32\cmd.exe"
npm install
```

To make it permanent: `setx ComSpec "C:\Windows\System32\cmd.exe"` (then open a new terminal).
