import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 does not forward rejected promises to the error handler automatically. */
export const asyncHandler =
  (
    handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
  ): RequestHandler =>
  (request, response, next) => {
    handler(request, response, next).catch(next);
  };
