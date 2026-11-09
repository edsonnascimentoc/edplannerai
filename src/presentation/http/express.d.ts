declare global {
  namespace Express {
    interface Request {
      traceId: string;
    }
  }
}

export {};
