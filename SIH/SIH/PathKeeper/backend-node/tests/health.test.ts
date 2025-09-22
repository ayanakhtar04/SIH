import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { notFoundHandler, errorHandler } from '../src/middleware/errorHandler';
import { requestLogger } from '../src/middleware/logger';
import router from '../src/routes';
import authRouter from '../src/routes.auth';
import mlRouter from '../src/routes.ml';


// Build an app instance mirroring production middleware order (minus rate limiting for speed)
function buildApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);
  app.use('/api/auth', authRouter);
  app.use('/api/ml', mlRouter);
  app.use('/api', router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('Health & basic routes', () => {
  const app = buildApp();

  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('usersSeeded');
  });

  it('POST /api/auth/login succeeds with seed admin password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@pathkeepers.local', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('POST /api/ml/predict returns a prediction', async () => {
    const res = await request(app)
      .post('/api/ml/predict')
      .send({ features: [1,2,3] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.prediction).toHaveProperty('riskScore');
  });

  it('POST /api/ml/train requires auth', async () => {
    const res = await request(app)
      .post('/api/ml/train')
      .send({});
    expect(res.status).toBe(401);
  });
});
