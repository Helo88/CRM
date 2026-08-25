import { Request, Response, NextFunction } from "express";

interface HttpError extends Error {
  status?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: HttpError, req: Request, res: Response, next: NextFunction): void {
  console.error("[error]", err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
}
