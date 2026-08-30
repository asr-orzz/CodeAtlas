import type { NextFunction, Request, Response } from "express";

/** An error carrying an HTTP status code. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Wrap an async route handler so thrown errors reach the error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
