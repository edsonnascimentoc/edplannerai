export type LogFields = Record<string, unknown>;

export interface ILoggerService {
  info(fields: LogFields, message: string): void;
  warn(fields: LogFields, message: string): void;
  error(fields: LogFields, message: string): void;
}
