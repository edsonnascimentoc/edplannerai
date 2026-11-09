import type { ErrorRequestHandler } from "express";
import type { ILoggerService } from "../../application/interfaces/logger-service.js";
import { AppError } from "../../domain/exceptions/app-error.js";

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  timestamp: string;
  traceId: string;
}

export function createGlobalErrorHandler(
  logger: ILoggerService,
): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const appError =
      error instanceof AppError
        ? error
        : new AppError(
            "Ocorreu um erro inesperado no processamento.",
            500,
            "ERR_INTERNAL_SERVER",
            "https://eduplanner.saas/errors/INTERNAL_SERVER_ERROR",
          );
    const statusCode = appError.statusCode;
    const problem: ProblemDetails = {
      type: appError.type,
      title:
        statusCode >= 500
          ? "Erro Interno do Servidor"
          : statusCode === 422
            ? "Regra de Negócio Violada"
            : "Erro de Requisição",
      status: statusCode,
      detail:
        statusCode >= 500
          ? "Ocorreu um erro inesperado no processamento."
          : appError.message,
      instance: req.originalUrl,
      code: appError.code,
      timestamp: new Date().toISOString(),
      traceId: req.traceId,
    };

    logger.error(
      {
        "event.category": "HTTP_ERROR",
        "trace.id": req.traceId,
        statusCode,
        path: req.originalUrl,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { message: String(error) },
      },
      "HTTP request failed",
    );

    res
      .status(statusCode)
      .type("application/problem+json")
      .json(problem);
  };
}
