import { Request, Response, NextFunction } from 'express';

import { logError } from './logger';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    ok: false,
    error: 'Not Found',
    status: 404
  });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  logError(err, req);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || 'Internal Server Error',
    status: err.status || 500
  });
}
