import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import {
  generateClassDiagram,
  generateComponentDiagram,
  generateGraphDiagram,
  generateSequenceDiagram,
} from "@archx/diagram";
import { runAnalysis } from "./analyze.js";
import {
  type Board,
  type BoardContent,
  type BoardEdge,
  type BoardNode,
  type BoardStore,
} from "./board-store.js";
import { gitClone, importFromGitHub, type Cloner } from "./github.js";
import { asyncHandler, HttpError } from "./http.js";
import type { ProjectRecord, ProjectStore } from "./store.js";
import { graphView, type GraphViewKind } from "./views.js";
import type { DiagramModel } from "@archx/diagram";

const DIAGRAM_KINDS = new Set([
  "class",
  "component",
  "sequence",
  "dependency",
  "call",
]);
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

const SEED_KINDS = new Set(["class", "component", "dependency", "call"]);

/** Flatten a laid-out diagram into editable board content. */
function diagramToBoard(model: DiagramModel): BoardContent {
  return {
    nodes: model.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      data: n.data,
    })),
    edges: model.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      label: e.label,
    })),
  };
}

function seedContent(record: ProjectRecord, kind: string): BoardContent {
  if (kind === "class") return diagramToBoard(generateClassDiagram(record.ir));
  if (kind === "component")
    return diagramToBoard(generateComponentDiagram(record.ir));
  return diagramToBoard(generateGraphDiagram(record.ir, kind as "dependency" | "call"));
}

/** Validate and normalize a board payload coming from the client. */
function parseBoardContent(body: unknown): BoardContent {
  const obj = (body ?? {}) as {
    name?: unknown;
    nodes?: unknown;
    edges?: unknown;
  };
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
    throw new HttpError(400, "Board must include 'nodes' and 'edges' arrays.");
  }
  const nodes: BoardNode[] = obj.nodes.map((raw, i) => {
    const n = raw as Partial<BoardNode>;
    if (typeof n.id !== "string" || typeof n.type !== "string") {
      throw new HttpError(400, `Node ${i} is missing 'id' or 'type'.`);
    }
    return {
      id: n.id,
      type: n.type,
      label: typeof n.label === "string" ? n.label : n.id,
      x: Number(n.x) || 0,
      y: Number(n.y) || 0,
      width: Number(n.width) || 160,
      height: Number(n.height) || 60,
      data: (n.data as BoardNode["data"]) ?? undefined,
    };
  });
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: BoardEdge[] = obj.edges
    .map((raw, i) => {
      const e = raw as Partial<BoardEdge>;
      if (typeof e.id !== "string" || typeof e.source !== "string" || typeof e.target !== "string") {
        throw new HttpError(400, `Edge ${i} is missing 'id', 'source' or 'target'.`);
      }
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: typeof e.type === "string" ? e.type : "association",
        label: typeof e.label === "string" ? e.label : undefined,
      };
    })
    // Drop dangling edges so a board never references removed nodes.
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  return {
    nodes,
    edges,
    name: typeof obj.name === "string" ? obj.name : undefined,
  };
}

function boardResponse(board: Board) {
  return board;
}

export function createRoutes(
  store: ProjectStore,
  boards: BoardStore,
  deps: RouteDeps = {},
): Router {
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
      boards.deleteByProject(id);
      res.status(204).end();
    }),
  );

  // --- Boards: manually edited architecture diagrams ---

  router.get(
    "/projects/:id/boards",
    asyncHandler((req, res) => {
      const record = requireProject(store, req.params.id);
      res.json({ boards: boards.listByProject(record.id) });
    }),
  );

  router.post(
    "/projects/:id/boards",
    asyncHandler((req, res) => {
      const record = requireProject(store, req.params.id);
      const body = (req.body ?? {}) as { name?: unknown; seedKind?: unknown };
      const name =
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : "Untitled board";
      let content: BoardContent | undefined;
      if (typeof body.seedKind === "string") {
        if (!SEED_KINDS.has(body.seedKind)) {
          throw new HttpError(400, `Cannot seed a board from: ${body.seedKind}`);
        }
        content = seedContent(record, body.seedKind);
      }
      const board = boards.create(record.id, name, content);
      res.status(201).json(boardResponse(board));
    }),
  );

  router.get(
    "/boards/:boardId",
    asyncHandler((req, res) => {
      const board = boards.get(req.params.boardId ?? "");
      if (!board) throw new HttpError(404, "Board not found.");
      res.json(boardResponse(board));
    }),
  );

  router.put(
    "/boards/:boardId",
    asyncHandler((req, res) => {
      const content = parseBoardContent(req.body);
      const board = boards.update(req.params.boardId ?? "", content);
      if (!board) throw new HttpError(404, "Board not found.");
      res.json(boardResponse(board));
    }),
  );

  router.delete(
    "/boards/:boardId",
    asyncHandler((req, res) => {
      if (!boards.delete(req.params.boardId ?? "")) {
        throw new HttpError(404, "Board not found.");
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
      if (kind === "dependency" || kind === "call")
        return void res.json(generateGraphDiagram(record.ir, kind));
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
