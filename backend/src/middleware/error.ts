import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error Handler]:', err.stack || err.message || err);

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'An unexpected error occurred on the server.';

  res.status(status).json({
    error: message,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};
