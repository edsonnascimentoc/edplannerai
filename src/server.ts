import { createServer } from "node:http";
import { createApp } from "./presentation/http/app.js";
import { logger } from "./infrastructure/logging/logger.js";
import { telemetry } from "./instrumentation.js";
import { checkDatabaseConnection } from "./infrastructure/database/database-health-check.js";
import { checkRedisConnection } from "./infrastructure/external-services/redis-health-check.js";
import {
  closeDatabaseConnection,
} from "./infrastructure/database/database-health-check.js";
import {
  closeRedisConnection,
} from "./infrastructure/external-services/redis-health-check.js";

const port = Number(process.env.PORT ?? 3000);
const server = createServer(
  createApp(
    {
      database: checkDatabaseConnection,
      redis: checkRedisConnection,
    },
    logger,
  ),
);

server.listen(port, () => {
  logger.info(
    {
      "event.category": "APPLICATION",
      port,
    },
    "EduPlanner API listening",
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info(
    { "event.category": "APPLICATION", signal },
    "Shutting down EduPlanner API",
  );

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await Promise.all([closeDatabaseConnection(), closeRedisConnection()]);
    await telemetry.shutdown();
  } catch (error) {
    logger.error(
      {
        "event.category": "APPLICATION_ERROR",
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : { message: String(error) },
      },
      "Graceful shutdown failed",
    );
    process.exitCode = 1;
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
