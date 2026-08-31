// Load .env before anything reads process.env (config, DB, AI provider, …).
import "dotenv/config";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { initSchema } from "./db.js";

async function main(): Promise<void> {
  if (!config.databaseUrl) {
    // eslint-disable-next-line no-console
    console.error(
      "[codeatlas] DATABASE_URL is not set. Add your Neon Postgres connection " +
        "string to apps/api/.env (see .env.example).",
    );
    process.exit(1);
  }

  // Ensure tables exist before accepting traffic.
  await initSchema();

  const app = createApp();
  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[codeatlas] API listening on http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log("[codeatlas] connected to Postgres");
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      // eslint-disable-next-line no-console
      console.error(
        `[codeatlas] Port ${config.port} is already in use. Set ARCHX_PORT to a free port.`,
      );
    } else {
      // eslint-disable-next-line no-console
      console.error("[codeatlas] Failed to start server:", err);
    }
    process.exit(1);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      // eslint-disable-next-line no-console
      console.log(`\n[codeatlas] ${signal} received, shutting down.`);
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[codeatlas] Fatal startup error:", err);
  process.exit(1);
});
