import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import {
  createAuthRoutes,
  PgUserStore,
  type UserStore,
} from "./auth.js";
import { BoardStore, PgBoardStore } from "./board-store.js";
import { config } from "./config.js";
import { getPool } from "./db.js";
import { HttpError } from "./http.js";
import { createRoutes, type RouteDeps } from "./routes.js";
import { PgProjectStore, type ProjectStore } from "./store.js";

export interface AppStores {
  projects: ProjectStore;
  boards: BoardStore;
  users: UserStore;
}

/** Production stores backed by the shared Postgres pool. */
function defaultStores(): AppStores {
  const pool = getPool();
  return {
    projects: new PgProjectStore(pool),
    boards: new PgBoardStore(pool),
    users: new PgUserStore(pool),
  };
}

/** Build the Express app (without starting the listener) for reuse in tests. */
export function createApp(
  stores: AppStores = defaultStores(),
  deps: RouteDeps = {},
): Express {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
    }),
  );
  app.use(express.json({ limit: "8mb" }));

  const serveWeb = Boolean(config.webDir && fs.existsSync(config.webDir));

  const apiInfo = (_req: Request, res: Response) => {
    res.json({
      name: "CodeAtlas API",
      endpoints: [
        "POST /api/auth/register",
        "POST /api/auth/login",
        "GET /api/auth/me",
        "POST /api/analyze",
        "POST /api/analyze/github",
        "GET /api/projects",
        "GET /api/projects/:id",
        "GET /api/projects/:id/diagram/:kind",
        "GET /api/projects/:id/graph/:view",
        "GET /api/projects/:id/boards",
        "POST /api/projects/:id/boards",
        "GET /api/boards",
        "POST /api/boards",
        "GET /api/boards/:boardId",
        "PUT /api/boards/:boardId",
        "DELETE /api/boards/:boardId",
        "GET /api/projects/:id/ai/explain",
        "GET /api/projects/:id/ai/smells",
        "GET /api/projects/:id/ai/cycles",
        "POST /api/projects/:id/ai/ask",
        "GET /api/projects/:id/nodes/:nodeId/:relation",
        "GET /api/projects/:id/path",
      ],
    });
  };

  if (!serveWeb) app.get("/", apiInfo);

  app.use("/api/auth", createAuthRoutes(stores.users));
  app.use("/api", createRoutes(stores.projects, stores.boards, deps));

  if (serveWeb && config.webDir) {
    const webDir = config.webDir;
    const indexHtml = path.join(webDir, "index.html");
    app.use(express.static(webDir));
    // SPA fallback: any non-/api GET that isn't a static asset returns index.html.
    app.get(/^(?!\/api\/).*/, (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET") return next();
      res.sendFile(indexHtml);
    });
  }

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    // Malformed JSON bodies surface as a SyntaxError from body-parser.
    if (err instanceof SyntaxError && "body" in (err as object)) {
      res.status(400).json({ error: "Invalid JSON in request body." });
      return;
    }
    // eslint-disable-next-line no-console
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);

  return app;
}
