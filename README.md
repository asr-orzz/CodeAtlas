# CodeAtlas

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

- TypeScript everywhere, npm workspaces monorepo
- [`ts-morph`](https://ts-morph.com/) for AST parsing (pure JS, no native builds)
- Hand-written graph algorithms
- [`dagre`](https://github.com/dagrejs/dagre) for hierarchical layout
- Express API with **Postgres** ([`pg`](https://node-postgres.com/)) — works great with a free [Neon](https://neon.tech) database
- **Email + password auth** (bcrypt + JWT); every project is private to its owner
- Vite + React + Tailwind CSS + React Flow for the interactive canvas, with a
  modern dark, glassmorphism landing + app UI
- Pluggable AI layer with a **deterministic fallback**, so it works without an API key
  (drop in a free **Grok** model via OpenRouter to enable the full LLM assistant)

## Getting started

CodeAtlas needs a Postgres database. The easiest option is a free
[Neon](https://neon.tech) project — create one and copy the **pooled**
connection string.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # then paste your DATABASE_URL + set JWT_SECRET
npm run dev                              # starts the API (:4000) and the web app together
```

Open the web app (Vite prints the URL, usually http://localhost:5173), **create
an account**, then analyze a local folder path or a GitHub URL. Tables are
created automatically on first boot.

Prefer two terminals? Run them separately:

```bash
npm run api          # terminal 1 — Express API on :4000
npm run web          # terminal 2 — Vite dev server
```

## Run with Docker

A single image builds the web app and serves it from the API on one port (4000):

Set `DATABASE_URL` (and ideally `JWT_SECRET`) in a local `.env` — compose reads
it automatically.

```bash
# Using docker compose (recommended)
docker compose up --build
# → open http://localhost:4000

# Or with plain docker
docker build -t codeatlas .
docker run -p 4000:4000 -e DATABASE_URL="postgres://…" -e JWT_SECRET="…" codeatlas
```

The web app is served at `/` and the API under `/api` on the same origin, so no
CORS or extra ports are needed. All data lives in your Postgres/Neon database;
the `/data` volume only holds transient clones. `git` is included in the image
for GitHub repo import (repos are only shallow-cloned and parsed, never executed).

## Configuration

Copy the example env files and adjust as needed (all values have sane defaults):

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

| Variable            | Where     | Default                 | Purpose                                  |
| ------------------- | --------- | ----------------------- | ---------------------------------------- |
| `DATABASE_URL`      | api       | (required)              | Postgres connection string (e.g. Neon)   |
| `JWT_SECRET`        | api       | dev placeholder         | Secret for signing login tokens          |
| `JWT_EXPIRES_IN`    | api       | `7d`                    | How long a login stays valid             |
| `ARCHX_PORT`        | api       | `4000`                  | API listen port                          |
| `ARCHX_DATA_DIR`    | api       | `./data`                | Scratch dir for cloned repos (not a DB)  |
| `ARCHX_CORS_ORIGIN` | api       | `*`                     | Allowed CORS origins (comma-separated)   |
| `ARCHX_WEB_DIR`     | api       | (unset)                 | Serve a built web bundle from the API (single-port mode) |
| `VITE_API_URL`      | web       | `http://localhost:4000` | API base URL the frontend calls (set to empty for same-origin) |

### Enabling the AI assistant (free Grok model)

The AI layer works offline with a deterministic engine. To turn on the full LLM
assistant, add an API key to `apps/api/.env` — the easiest option is a **free
Grok model via [OpenRouter](https://openrouter.ai/keys)**:

```bash
# apps/api/.env
OPENROUTER_API_KEY=sk-or-...          # uses x-ai/grok-4-fast:free by default
# AI_MODEL=x-ai/grok-4-fast:free      # optional override (e.g. openrouter/free)
```

Any OpenAI-compatible endpoint works. Alternatives:

- **xAI directly:** set `XAI_API_KEY=...` (defaults to the `grok-4-fast` model).
- **Custom gateway:** set `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`.

If no key is set, the assistant automatically falls back to the deterministic,
fact-based engine — nothing breaks offline. Free models on OpenRouter can be
rate-limited or rotated, so pick a paid model for heavy use.

**Data & persistence:** users, projects and boards live in Postgres. Point
`DATABASE_URL` at a free [Neon](https://neon.tech) database; the schema is
created automatically on first boot. Every project and board is scoped to the
account that created it.

## API reference

All `/api/*` routes below require a `Authorization: Bearer <token>` header
obtained from register/login.

```
POST   /api/auth/register                     { email, password, name? }  → { token, user }
POST   /api/auth/login                        { email, password }         → { token, user }
GET    /api/auth/me                                                        → { user }
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
