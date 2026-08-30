import path from "node:path";

export const config = {
  port: Number(process.env.ARCHX_PORT ?? process.env.PORT ?? 4000),
  /** Where analyzed projects and saved boards are persisted. */
  dataDir: process.env.ARCHX_DATA_DIR
    ? path.resolve(process.env.ARCHX_DATA_DIR)
    : path.resolve(process.cwd(), "data"),
  /** Comma-separated allowed CORS origins, or "*" for any. */
  corsOrigin: process.env.ARCHX_CORS_ORIGIN ?? "*",
  /**
   * Optional directory of built web assets to serve (single-port production
   * mode). When set, the API serves the SPA and routes non-/api requests to it.
   */
  webDir: process.env.ARCHX_WEB_DIR
    ? path.resolve(process.env.ARCHX_WEB_DIR)
    : undefined,
};
