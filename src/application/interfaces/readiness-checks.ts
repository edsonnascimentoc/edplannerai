export interface DatabaseHealth {
  database: boolean;
  timescaledb: boolean;
}

export interface ReadinessChecks {
  database(): Promise<DatabaseHealth>;
  redis(): Promise<void>;
}
