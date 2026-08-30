import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[archx] API listening on http://localhost:${config.port}`);
  // eslint-disable-next-line no-console
  console.log(`[archx] data dir: ${config.dataDir}`);
});
