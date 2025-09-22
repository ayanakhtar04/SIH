import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import { signUser } from '../src/auth/jwt';

const adminUser = { id: 'admin-test-2', email: 'admin2@test.local', name:'Admin2', role:'admin', passwordHash:'x' } as any;

beforeAll(async () => {
  await prisma.user.upsert({ where:{ email: adminUser.email }, update:{}, create: adminUser });
});

describe('Risk Model Config', () => {
  const token = signUser(adminUser);
  it('GET returns a config (auto-created if missing)', async () => {
    const res = await request(app).get('/api/admin/config/risk-model').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.config).toHaveProperty('weights');
  });
  it('PUT updates and versions config', async () => {
    const res = await request(app).put('/api/admin/config/risk-model')
      .set('Authorization', `Bearer ${token}`)
      .send({ weights:{ attendance:0.25, gpa:0.45, assignments:0.2, notes:0.1 }, thresholds:{ high:0.75, medium:0.5 } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.config.weights.gpa).toBe(0.45);
  });
});

describe('Notify & Assist', () => {
  const token = signUser(adminUser);
  it('AI draft endpoint returns draft', async () => {
    const res = await request(app).post('/api/assist/draft').set('Authorization', `Bearer ${token}`).send({ contextType:'outreach', tone:'supportive' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.draft).toBe('string');
  });
  it('Notify validates missing recipients', async () => {
    const res = await request(app).post('/api/notify').set('Authorization', `Bearer ${token}`).send({ channel:'email', body:'Hello' });
    expect(res.status).toBe(400);
  });
});
