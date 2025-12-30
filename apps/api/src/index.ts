import express from "express";
import type { Express } from "express";
import { initDb, checkDbHealth, shutdownDb } from "@repo/db";
import { requestIdMiddleware, errorHandler } from "./middlewares/index.ts";
import { isRedisHealthy, initRedis } from "@repo/redis";
import authRouter from "./routes/auth.ts";
import orderRouter from "./routes/orders.ts";
import portfolioRouter from './routes/portfolio.ts'

export function createApp(): Express {
  const app = express();

  // Essential Middleware

  // 1. JSON body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 2. Request ID generation
  app.use(requestIdMiddleware);

  // Health check endpoint
  app.get("/health", async (_req, res) => {
    const withTimeout: any = (promise: Promise<any>, ms: number) => {
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), ms)
        ),
      ]);
    };
    const [db, redisHealthy] = await Promise.all([
      withTimeout(checkDbHealth(), 5000),
      withTimeout(isRedisHealthy(), 5000),
    ]);

    if (!redisHealthy) {
      return res.status(503).json({ status: "degraded", redis: "unhealthy" });
    }

    if (!db.ok) {
      return res.status(503).json({ status: "degraded", db });
    }

    return res
      .status(200)
      .json({ dbHealth: "healthy", db, redisHealth: "healthy", redisHealthy });
  });

  // Routes
  app.use("/auth", authRouter);
  app.use("/orders",orderRouter);
  app.use("/portfolio",portfolioRouter);

  // 3. Centralized error handler (must be last)
  app.use(errorHandler);

  return app;
}

const isMainModule =
  process.argv[1]?.includes("index.ts") ||
  process.argv[1]?.includes("index.js");

if (isMainModule) {
  const start = async () => {
    try {
      await initDb();
      await initRedis();
    } catch (error) {
      console.error("Failed to initialize critical dependencies", error);
      process.exit(1);
    }

    const app = createApp();
    const port = process.env.PORT || 3001;

    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    const shutdown = async (signal: string) => {
      console.log(`${signal} received, shutting down...`);
      server.close(async () => {
        await shutdownDb().catch(() => {});
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  };

  void start();
}
