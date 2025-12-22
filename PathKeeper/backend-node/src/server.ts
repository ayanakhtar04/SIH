import fs from 'fs';
import path from 'path';

import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yaml';

import { CONFIG } from './config/env';
import { logger } from './logging/logger';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import router from './routes';
import authRouter from './routes.auth';
import mlRouter from './routes.ml';
import studentsRouter from './routes.students';
import extendedAuthRouter from './routes.auth.extended';
import usersRouter from './routes.users';
import signupRouter from './routes.signup';
import playbooksRouter from './routes.playbooks';
import meetingsRouter from './routes.meetings';
import notificationsRouter from './routes.notifications';
import riskConfigRouter from './routes.riskConfig';
import metricsRouter from './routes.admin.metrics';
import menteeFormRouter from './routes.menteeForm';
import mentorFormRouter from './routes.mentorForm';




function createServer() {
  const app = express();
  // Security headers
  app.use(helmet());
  const allowlist = CONFIG.CORS_ORIGINS;
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!allowlist.length || allowlist.includes(origin)) return cb(null, true);
      return cb(new Error('CORS not allowed'), false);
    },
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.text({ type: 'text/csv', limit: '1mb' }));
  app.use(requestLogger);
  const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Too many login attempts, please try later', status: 429 }
  });
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/auth', extendedAuthRouter); // student & teacher flows
  app.use('/api/signup', signupRouter); // student invite/activation flows
  app.use('/api/ml', mlRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/playbooks', playbooksRouter);
  app.use('/api/meetings', meetingsRouter);
  app.use('/api', notificationsRouter); // notify & assist endpoints
  app.use('/api', riskConfigRouter); // risk model configuration
  app.use('/api', metricsRouter); // admin metrics endpoints
  app.use('/api/mentee-form', menteeFormRouter);
  app.use('/api/mentor-form', mentorFormRouter);
  try {
    const specPath = path.join(process.cwd(), 'src', 'openapi.yaml');
    if (fs.existsSync(specPath)) {
      const raw = fs.readFileSync(specPath, 'utf8');
      const doc = yaml.parse(raw);
      app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(doc));
      logger.info({ specPath }, 'openapi:loaded');
    } else {
      logger.warn({ specPath }, 'openapi:missing');
    }
  } catch (e) {
    logger.error({ err: e }, 'openapi:load-failed');
  }
  app.use('/api', router);

  // Health check endpoint for proxy and readiness
  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
  app.get('/', (_req, res) => { res.send('PathKeepers Backend API'); });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
const app = createServer();
let httpServer: import('http').Server | undefined;

function start() {
  try {
    httpServer = app.listen(CONFIG.PORT, '0.0.0.0', () => {
      if (!httpServer) return;
      const addr = httpServer.address();
      const corsOriginsCount = CONFIG.CORS_ORIGINS.length;
      logger.info({ addr, port: CONFIG.PORT, corsOrigins: corsOriginsCount, jwtSecretLen: CONFIG.JWT_SECRET.length }, 'server:start');
    });
    setInterval(() => logger.debug({ ts: Date.now() }, 'heartbeat'), 10000);
    httpServer.on('error', (err) => {
      logger.error({ err }, 'server:error');
    });
  } catch (err) {
    logger.fatal({ err }, 'server:startup-fatal');
  }
}

async function shutdown(signal: string) {
  logger.warn({ signal }, 'shutdown:init');
  const timeoutMs = 8000;
  const deadline = setTimeout(() => {
    logger.fatal({ signal }, 'shutdown:forced-exit');
    process.exit(1);
  }, timeoutMs).unref();

  try {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
      logger.info({ signal }, 'shutdown:http-closed');
    }
    // Future: close DB connections, flush metrics, etc.
    clearTimeout(deadline);
    logger.info({ signal }, 'shutdown:complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err, signal }, 'shutdown:error');
    process.exit(1);
  }
}

['SIGINT', 'SIGTERM'].forEach(sig => {
  process.on(sig as NodeJS.Signals, () => shutdown(sig));
});

// Avoid automatically starting the HTTP listener during test runs to prevent port conflicts.
if (CONFIG.NODE_ENV !== 'test') { start(); }

export { app, createServer };
