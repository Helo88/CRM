import { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";

function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid request";
}

// Parses req.body against `schema` and replaces it with the parsed
// (trimmed/coerced/defaulted) result, so downstream handlers can trust the
// shape instead of re-checking it — same `{ error: string }` 400 contract
// every route already used for hand-rolled validation.
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(400).json({ error: firstIssueMessage(result.error) });
      return;
    }
    req.body = result.data;
    next();
  };
}

// Params stay strings (no coercion needed for an ObjectId-shaped param), so
// this only rejects — it never needs to write back to req.params.
export function validateParams<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({ error: firstIssueMessage(result.error) });
      return;
    }
    next();
  };
}
