import type { ErrorRequestHandler } from 'express';

import { HttpError } from '../shared/http-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: {
        message: error.message,
      },
    });
    return;
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error';

  response.status(500).json({
    error: {
      message,
    },
  });
};
