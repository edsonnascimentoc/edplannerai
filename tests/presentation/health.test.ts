import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import type { ILoggerService } from "../../src/application/interfaces/logger-service.js";
import { DomainException } from "../../src/domain/exceptions/domain-exception.js";
import { createApp } from "../../src/presentation/http/app.js";
import { createGlobalErrorHandler } from "../../src/presentation/middlewares/global-error-handler.js";
import { traceIdMiddleware } from "../../src/presentation/middlewares/trace-id.js";

const testLogger: ILoggerService = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer(
    createApp(
      {
        database: async () => ({ database: true, timescaledb: true }),
        redis: async () => undefined,
      },
      testLogger,
    ),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("liveness reports that the process is up", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  const body = (await response.json()) as { status: string; timestamp: string };

  assert.equal(response.status, 200);
  assert.equal(body.status, "UP");
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
});

test("readiness reports each available dependency", async () => {
  const response = await fetch(`${baseUrl}/readyz`);
  const body = (await response.json()) as {
    status: string;
    checks: Record<string, string>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.status, "READY");
  assert.deepEqual(body.checks, {
    database: "UP",
    timescaledb: "UP",
    redis: "UP",
  });
});

test("readiness returns 503 when a required dependency is unavailable", async () => {
  const unavailableServer = createServer(
    createApp(
      {
        database: async () => ({ database: true, timescaledb: false }),
        redis: async () => {
          throw new Error("connection refused");
        },
      },
      testLogger,
    ),
  );
  await new Promise<void>((resolve) =>
    unavailableServer.listen(0, "127.0.0.1", resolve),
  );

  try {
    const address = unavailableServer.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/readyz`);
    const body = (await response.json()) as {
      status: string;
      checks: Record<string, string>;
    };

    assert.equal(response.status, 503);
    assert.equal(body.status, "NOT_READY");
    assert.deepEqual(body.checks, {
      database: "UP",
      timescaledb: "DOWN",
      redis: "DOWN",
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      unavailableServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("unknown routes return RFC 7807 problem details and a trace id", async () => {
  const response = await fetch(`${baseUrl}/unknown`, {
    headers: { "x-trace-id": "c4a9f8e7123456789abcdef012345678" },
  });
  const body = (await response.json()) as {
    type: string;
    status: number;
    code: string;
    instance: string;
    traceId: string;
  };

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("content-type")?.split(";")[0], "application/problem+json");
  assert.equal(body.type, "https://eduplanner.saas/errors/NOT_FOUND");
  assert.equal(body.status, 404);
  assert.equal(body.code, "ERR_NOT_FOUND");
  assert.equal(body.instance, "/unknown");
  assert.equal(body.traceId, "c4a9f8e7123456789abcdef012345678");
  assert.equal(response.headers.get("x-trace-id"), body.traceId);
});

test("domain rule violations return RFC 7807 with status 422", async () => {
  const app = express();
  app.use(traceIdMiddleware);
  app.get("/rule", (_req, _res, next) => {
    next(
      new DomainException(
        "A avaliação deve possuir no mínimo 80% de preenchimento.",
        "ERR_RN02_INCOMPLETO",
      ),
    );
  });
  app.use(createGlobalErrorHandler(testLogger));
  const ruleServer = createServer(app);
  await new Promise<void>((resolve) =>
    ruleServer.listen(0, "127.0.0.1", resolve),
  );

  try {
    const address = ruleServer.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/rule`);
    const body = (await response.json()) as {
      title: string;
      status: number;
      detail: string;
      code: string;
      traceId: string;
    };

    assert.equal(response.status, 422);
    assert.equal(body.title, "Regra de Negócio Violada");
    assert.equal(body.status, 422);
    assert.equal(
      body.detail,
      "A avaliação deve possuir no mínimo 80% de preenchimento.",
    );
    assert.equal(body.code, "ERR_RN02_INCOMPLETO");
    assert.ok(body.traceId);
  } finally {
    await new Promise<void>((resolve, reject) => {
      ruleServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("internal errors do not expose their details to clients", async () => {
  const errorServer = createServer(
    createApp(
      {
        database: async () => {
          throw new Error("private database connection detail");
        },
        redis: async () => undefined,
      },
      testLogger,
    ),
  );
  await new Promise<void>((resolve) =>
    errorServer.listen(0, "127.0.0.1", resolve),
  );

  try {
    const address = errorServer.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/readyz`);
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private database connection detail/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      errorServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
