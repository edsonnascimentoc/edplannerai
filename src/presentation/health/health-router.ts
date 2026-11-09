import { Router } from "express";
import type { ILoggerService } from "../../application/interfaces/logger-service.js";
import type { ReadinessChecks } from "../../application/interfaces/readiness-checks.js";

export function createHealthRouter(
  checks: ReadinessChecks,
  logger: ILoggerService,
): Router {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.status(200).json({
      status: "UP",
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/readyz", async (req, res) => {
    const [databaseResult, redisResult] = await Promise.allSettled([
      checks.database(),
      checks.redis(),
    ]);

    const database =
      databaseResult.status === "fulfilled"
        ? databaseResult.value.database
        : false;
    const timescaledb =
      databaseResult.status === "fulfilled"
        ? databaseResult.value.timescaledb
        : false;
    const redis = redisResult.status === "fulfilled";

    if (databaseResult.status === "rejected") {
      logger.warn(
        {
          "event.category": "HEALTH_CHECK",
          "trace.id": req.traceId,
          dependency: "database",
          error: { message: String(databaseResult.reason) },
        },
        "Readiness dependency check failed",
      );
    }
    if (redisResult.status === "rejected") {
      logger.warn(
        {
          "event.category": "HEALTH_CHECK",
          "trace.id": req.traceId,
          dependency: "redis",
          error: { message: String(redisResult.reason) },
        },
        "Readiness dependency check failed",
      );
    }

    const ready = database && timescaledb && redis;
    res.status(ready ? 200 : 503).json({
      status: ready ? "READY" : "NOT_READY",
      checks: {
        database: database ? "UP" : "DOWN",
        timescaledb: timescaledb ? "UP" : "DOWN",
        redis: redis ? "UP" : "DOWN",
      },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
