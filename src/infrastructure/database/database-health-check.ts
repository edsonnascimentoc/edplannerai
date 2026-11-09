import { Pool } from "pg";
import type { DatabaseHealth } from "../../application/interfaces/readiness-checks.js";

let pool: Pool | undefined;

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the database health check.");
  }

  pool ??= new Pool({ connectionString });
  return pool;
}

export async function checkDatabaseConnection(): Promise<DatabaseHealth> {
  const result = await getPool().query<{ timescaledb_installed: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') AS timescaledb_installed",
  );

  return {
    database: true,
    timescaledb: result.rows[0]?.timescaledb_installed ?? false,
  };
}

export async function closeDatabaseConnection(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
