import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express handler so rejected promises reach errorHandler
 * instead of crashing the process or hanging the request.
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
