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
  core/         @archx/core          — the Architecture IR + shared domain types
  graph/        @archx/graph         — graph engine + algorithms (cycles, paths, topo sort)
  analyzer/     @archx/analyzer      — ts-morph static analysis for TS/JS
  architecture/ @archx/architecture  — role classification, aggregation, metrics report
  diagram/      @archx/diagram       — dagre layout + class/component/sequence generation
  ai/           @archx/ai            — assistant: explain, smells, graph tools, canvas agent
apps/
  api/          @archx/api           — Express API (analyze repos, serve IR & diagrams, AI)
  web/          @archx/web           — Vite + React + Tailwind + React Flow canvas
```

## Features

- **Analyze** a local folder or a public GitHub repo (safe shallow clone, never executed).
- **Explore** the architecture with five deterministic views: class UML, component
  diagram, dependency graph, call graph, and a traced sequence diagram.
- **Node detail panel** — click any type to see its members and its incoming/outgoing
  relationships.
- **Boards** — a manual editor (React Flow) to add/edit/delete nodes and typed
  relationships, seed from a generated diagram, and save/load per project.
- **AI assistant** (deterministic by default, pluggable LLM):
  - explain the architecture, list dependency cycles, flag smells
    (circular deps, layering violations, god objects);
  - answer graph queries and **drive the canvas** — e.g. `what does UserService
    depend on?`, `who calls Database?`, `path from A to B`, `trace UserController`,
    `focus PaymentService`.

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
npm run dev          # starts the API (:4000) and the web app together
```

Then open the web app (Vite prints the URL, usually http://localhost:5173) and
analyze a local folder path or a GitHub URL.

Prefer two terminals? Run them separately:

```bash
npm run api          # terminal 1 — Express API on :4000
npm run web          # terminal 2 — Vite dev server
```

> This is an MVP that captures the core technical story. Multiplayer (Yjs),
> Postgres/Redis, GitHub OAuth and PR bots from the extended vision are intentionally
> out of scope for the first working version.

## Configuration

Copy the example env files and adjust as needed (all values have sane defaults):

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

| Variable            | Where     | Default                 | Purpose                                  |
| ------------------- | --------- | ----------------------- | ---------------------------------------- |
| `ARCHX_PORT`        | api       | `4000`                  | API listen port                          |
| `ARCHX_DATA_DIR`    | api       | `./data`                | Where projects & boards are persisted    |
| `ARCHX_CORS_ORIGIN` | api       | `*`                     | Allowed CORS origins (comma-separated)   |
| `VITE_API_URL`      | web       | `http://localhost:4000` | API base URL the frontend calls          |

The AI layer works offline with a deterministic engine. To plug in a real LLM,
implement `createProviderFromEnv` in `packages/ai/src/provider.ts`.

## API reference

```
POST   /api/analyze                          { path, name? }
POST   /api/analyze/github                    { url, branch?, name? }
GET    /api/projects
GET    /api/projects/:id
DELETE /api/projects/:id
GET    /api/projects/:id/diagram/:kind        class|component|sequence|dependency|call
GET    /api/projects/:id/graph/:view          dependency|call
GET    /api/projects/:id/nodes/:nodeId/:rel   dependencies|dependents|callers|callees
GET    /api/projects/:id/path?from=&to=
GET    /api/projects/:id/ai/explain
GET    /api/projects/:id/ai/smells
GET    /api/projects/:id/ai/cycles
POST   /api/projects/:id/ai/ask               { question }
GET    /api/projects/:id/boards
POST   /api/projects/:id/boards               { name?, seedKind? }
GET    /api/boards/:boardId
PUT    /api/boards/:boardId                   { name?, nodes, edges }
DELETE /api/boards/:boardId
```

## Development

```bash
npm run typecheck   # type-check every package (project references)
npm test            # run all unit + API integration tests (vitest)
npm run build       # production build of the web app
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
