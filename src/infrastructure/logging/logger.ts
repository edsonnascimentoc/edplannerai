import { context, trace } from "@opentelemetry/api";
import pino from "pino";
import type {
  ILoggerService,
  LogFields,
} from "../../application/interfaces/logger-service.js";

export const serviceName = "eduplanner-api";

const pinoLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    "service.name": serviceName,
  },
  timestamp: () => `,"@timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => ({ "log.level": label.toUpperCase() }),
  },
  mixin: () => {
    const spanContext = trace.getSpan(context.active())?.spanContext();
    return spanContext
      ? {
          "trace.id": spanContext.traceId,
          "span.id": spanContext.spanId,
        }
      : {};
  },
});

export const logger: ILoggerService = {
  info(fields: LogFields, message: string) {
    pinoLogger.info(fields, message);
  },
  warn(fields: LogFields, message: string) {
    pinoLogger.warn(fields, message);
  },
  error(fields: LogFields, message: string) {
    pinoLogger.error(fields, message);
  },
};
