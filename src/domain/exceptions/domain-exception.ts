import { AppError } from "./app-error.js";

export class DomainException extends AppError {
  constructor(message: string, code: string) {
    super(
      message,
      422,
      code,
      `https://eduplanner.saas/errors/${encodeURIComponent(code)}`,
    );
  }
}
