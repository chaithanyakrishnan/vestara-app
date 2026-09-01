import { createApp } from "./app";
import { env } from "./lib/env";

const app = createApp();
app.listen(env.port, () => {
  console.log(`[vestara-api] listening on http://localhost:${env.port}`);
});
