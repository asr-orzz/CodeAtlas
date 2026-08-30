import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type Express,
  type Request,
  type Response,
} from "express";
import { BoardStore } from "./board-store.js";
import { config } from "./config.js";
import { HttpError } from "./http.js";
import { createRoutes, type RouteDeps } from "./routes.js";
import { ProjectStore } from "./store.js";

/** Build the Express app (without starting the listener) for reuse in tests. */
export function createApp(
  store: ProjectStore = new ProjectStore(config.dataDir),
  boards: BoardStore = new BoardStore(config.dataDir),
  deps: RouteDeps = {},
): Express {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
    }),
  );
  app.use(express.json({ limit: "4mb" }));

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "AI Software Architecture Explorer API",
      endpoints: [
        "POST /api/analyze",
        "POST /api/analyze/github",
        "GET /api/projects",
        "GET /api/projects/:id",
        "GET /api/projects/:id/diagram/:kind",
        "GET /api/projects/:id/graph/:view",
        "GET /api/projects/:id/boards",
        "POST /api/projects/:id/boards",
        "GET /api/boards/:boardId",
        "PUT /api/boards/:boardId",
        "DELETE /api/boards/:boardId",
      ],
    });
  });

  app.use("/api", createRoutes(store, boards, deps));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    // eslint-disable-next-line no-console
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);

  return app;
}
