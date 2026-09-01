import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./lib/env";
import { errorHandler } from "./middleware/error.middleware";
import { authRouter } from "./modules/auth/auth.routes";
import { plansRouter } from "./modules/plans/plans.routes";
import { extractionRouter } from "./modules/extraction/extraction.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);
  app.use("/api/plans", plansRouter);
  app.use("/api", extractionRouter); // /api/plans/:planId/documents, /api/documents/:id/extract

  app.use(errorHandler);
  return app;
}
