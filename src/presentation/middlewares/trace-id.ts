import { context, trace } from "@opentelemetry/api";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const TRACE_ID_PATTERN =
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function normalizeTraceId(value: string | undefined): string | undefined {
  if (!value || !TRACE_ID_PATTERN.test(value)) {
    return undefined;
  }
  return value.replaceAll("-", "").toLowerCase();
}

export const traceIdMiddleware: RequestHandler = (req, res, next) => {
  const spanTraceId = trace.getSpan(context.active())?.spanContext().traceId;
  req.traceId =
    spanTraceId ??
    normalizeTraceId(req.get("x-trace-id")) ??
    randomUUID().replaceAll("-", "");
  res.setHeader("x-trace-id", req.traceId);
  next();
};
