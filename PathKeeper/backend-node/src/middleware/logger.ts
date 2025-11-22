import { randomUUID } from 'crypto';

import { Request, Response, NextFunction } from 'express';

import { logger } from '../logging/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const reqId = randomUUID();
  (req as any).reqId = reqId;
  const start = Date.now();
  logger.debug({ reqId, method: req.method, url: req.originalUrl, msg: 'request:start' });
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info({ reqId, method: req.method, url: req.originalUrl, status: res.statusCode, ms, msg: 'request:complete' });
  });
  next();
}

export function logError(err: any, req: Request) {
  const reqId = (req as any).reqId || '-';
  logger.error({ reqId, err, msg: 'request:error' });
}
