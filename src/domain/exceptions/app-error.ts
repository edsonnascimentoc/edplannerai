export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly type: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
