import { createClient } from "redis";
import { logger } from "../logging/logger.js";

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | undefined;
let connecting: Promise<void> | undefined;

function getClient(): RedisClient {
  if (client) {
    return client;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required for the Redis health check.");
  }

  client = createClient({ url });
  client.on("error", (error: Error) => {
    logger.error(
      {
        "event.category": "DEPENDENCY_ERROR",
        error: { message: error.message },
      },
      "Redis client error",
    );
  });
  return client;
}

async function connectIfNeeded(redis: RedisClient): Promise<void> {
  if (connecting) {
    await connecting;
    return;
  }
  if (redis.isOpen) {
    return;
  }

  connecting ??= redis
    .connect()
    .then(() => undefined)
    .finally(() => {
      connecting = undefined;
    });
  await connecting;
}

export async function checkRedisConnection(): Promise<void> {
  const redis = getClient();
  await connectIfNeeded(redis);
  await redis.ping();
}

export async function closeRedisConnection(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
  }
  client = undefined;
  connecting = undefined;
}
