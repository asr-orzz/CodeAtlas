import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import {
  generateClassDiagram,
  generateComponentDiagram,
  generateSequenceDiagram,
} from "@archx/diagram";
import { runAnalysis } from "./analyze.js";
import { gitClone, importFromGitHub, type Cloner } from "./github.js";
import { asyncHandler, HttpError } from "./http.js";
import type { ProjectRecord, ProjectStore } from "./store.js";
import { graphView, type GraphViewKind } from "./views.js";

const DIAGRAM_KINDS = new Set(["class", "component", "sequence"]);
const GRAPH_VIEWS = new Set<GraphViewKind>(["dependency", "call"]);

export interface RouteDeps {
  /** Injectable clone implementation (stubbed in tests). */
  cloner?: Cloner;
}

function importResponse(record: ProjectRecord) {
  return {
    id: record.id,
    name: record.name,
    source: record.source,
    createdAt: record.createdAt,
    meta: {
      owner: record.ir.meta.owner,
      repository: record.ir.meta.repository,
      branch: record.ir.meta.branch,
      commit: record.ir.meta.commit,
    },
    report: record.report,
  };
}

export function createRoutes(store: ProjectStore, deps: RouteDeps = {}): Router {
  const router = Router();
  const cloner = deps.cloner ?? gitClone;

  router.get(
    "/health",
    asyncHandler((_req, res) => {
      res.json({ ok: true, projects: store.list().length });
    }),
  );

  // Analyze a local directory.
  router.post(
    "/analyze",
    asyncHandler((req, res) => {
      const body = (req.body ?? {}) as { path?: unknown; name?: unknown };
      if (typeof body.path !== "string" || body.path.trim() === "") {
        throw new HttpError(400, "Body must include a non-empty 'path' string.");
      }
      const resolved = path.resolve(body.path);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(resolved);
      } catch {
        throw new HttpError(404, `Path not found: ${resolved}`);
      }
      if (!stat.isDirectory()) {
        throw new HttpError(400, `Path is not a directory: ${resolved}`);
      }

      const name =
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : path.basename(resolved) || resolved;

      const { ir, report } = runAnalysis(resolved, { rootPath: resolved });
      const record = store.create({ name, source: resolved, ir, report });
      res.status(201).json(importResponse(record));
    }),
  );

  // Import and analyze a public GitHub repository.
  router.post(
    "/analyze/github",
    asyncHandler((req, res) => {
      const body = (req.body ?? {}) as {
        url?: unknown;
        branch?: unknown;
        name?: unknown;
      };
      if (typeof body.url !== "string" || body.url.trim() === "") {
        throw new HttpError(400, "Body must include a non-empty 'url' string.");
      }
      const record = importFromGitHub(
        store,
        {
          url: body.url,
          branch: typeof body.branch === "string" ? body.branch : undefined,
          name: typeof body.name === "string" ? body.name : undefined,
        },
        cloner,
      );
      res.status(201).json(importResponse(record));
    }),
  );

  router.get(
    "/projects",
    asyncHandler((_req, res) => {
      res.json({ projects: store.list() });
    }),
  );

  router.get(
    "/projects/:id",
    asyncHandler((req, res) => {
      const record = requireProject(store, req.params.id);
      res.json({
        id: record.id,
        name: record.name,
        source: record.source,
        createdAt: record.createdAt,
        ir: record.ir,
        report: record.report,
      });
    }),
  );

  router.delete(
    "/projects/:id",
    asyncHandler((req, res) => {
      const id = req.params.id ?? "";
      if (!store.delete(id)) {
        throw new HttpError(404, "Project not found.");
      }
      res.status(204).end();
    }),
  );

  router.get(
    "/projects/:id/diagram/:kind",
    asyncHandler((req, res) => {
      const record = requireProject(store, req.params.id);
      const kind = req.params.kind ?? "";
      if (!DIAGRAM_KINDS.has(kind)) {
        throw new HttpError(400, `Unknown diagram kind: ${kind}`);
      }
      if (kind === "class") return void res.json(generateClassDiagram(record.ir));
      if (kind === "component")
        return void res.json(generateComponentDiagram(record.ir));
      const entryId =
        typeof req.query.entryId === "string" ? req.query.entryId : undefined;
      return void res.json(generateSequenceDiagram(record.ir, { entryId }));
    }),
  );

  router.get(
    "/projects/:id/graph/:view",
    asyncHandler((req, res) => {
      const record = requireProject(store, req.params.id);
      const view = (req.params.view ?? "") as GraphViewKind;
      if (!GRAPH_VIEWS.has(view)) {
        throw new HttpError(400, `Unknown graph view: ${view}`);
      }
      res.json(graphView(record.ir, view));
    }),
  );

  return router;
}

function requireProject(store: ProjectStore, id: string | undefined) {
  const record = id ? store.get(id) : undefined;
  if (!record) throw new HttpError(404, "Project not found.");
  return record;
}
