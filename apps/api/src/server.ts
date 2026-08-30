import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[archx] API listening on http://localhost:${config.port}`);
  // eslint-disable-next-line no-console
  console.log(`[archx] data dir: ${config.dataDir}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    // eslint-disable-next-line no-console
    console.error(
      `[archx] Port ${config.port} is already in use. Set ARCHX_PORT to a free port.`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.error("[archx] Failed to start server:", err);
  }
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    // eslint-disable-next-line no-console
    console.log(`\n[archx] ${signal} received, shutting down.`);
    server.close(() => process.exit(0));
  });
}
