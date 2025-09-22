import pino from 'pino';

import { CONFIG } from '../config/env';

const isDev = CONFIG.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  redact: {
    paths: ['req.headers.authorization', 'password', '*.password'],
    remove: true
  },
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      singleLine: true
    }
  } : undefined,
  base: {
    service: 'pathkeepers-backend',
    env: CONFIG.NODE_ENV
  }
});

export function childLogger(bindings: Record<string, any>) {
  return logger.child(bindings);
}
