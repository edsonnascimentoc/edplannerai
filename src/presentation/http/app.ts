import express from "express";
import type { ILoggerService } from "../../application/interfaces/logger-service.js";
import type { ReadinessChecks } from "../../application/interfaces/readiness-checks.js";
import { AppError } from "../../domain/exceptions/app-error.js";
import { createGlobalErrorHandler } from "../middlewares/global-error-handler.js";
import { traceIdMiddleware } from "../middlewares/trace-id.js";
import { createHealthRouter } from "../health/health-router.js";

export function createApp(checks: ReadinessChecks, logger: ILoggerService) {
  const app = express();

  app.use(traceIdMiddleware);
  app.use(express.json());
  app.use((req, res, next) => {
    res.on("finish", () => {
      logger.info(
        {
          "event.category": "HTTP_REQUEST",
          "trace.id": req.traceId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
        },
        "HTTP request completed",
      );
    });
    next();
  });
  app.use(createHealthRouter(checks, logger));
  app.use((req, _res, next) => {
    next(
      new AppError(
        `No route found for ${req.method} ${req.originalUrl}.`,
        404,
        "ERR_NOT_FOUND",
        "https://eduplanner.saas/errors/NOT_FOUND",
      ),
    );
  });
  app.use(createGlobalErrorHandler(logger));

  return app;
}
