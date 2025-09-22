import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import { signUser } from '../src/auth/jwt';

const adminUser = { id: 'admin-test-1', email: 'admin@test.local', name:'Admin Test', role:'admin', passwordHash:'x' } as any;

beforeAll(async () => {
  // Ensure admin exists (idempotent)
  await prisma.user.upsert({ where:{ email: adminUser.email }, update:{}, create: adminUser });
});

describe('Admin Metrics Endpoints', () => {
  const token = signUser(adminUser);
  it('returns overview metrics', async () => {
    const res = await request(app).get('/api/admin/metrics/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.overview).toHaveProperty('studentsTotal');
  });
  it('returns risk trend', async () => {
    const res = await request(app).get('/api/admin/metrics/risk-trend?days=10').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.trend)).toBe(true);
  });
  it('returns interventions effectiveness', async () => {
    const res = await request(app).get('/api/admin/metrics/interventions/effectiveness').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.effectiveness).toHaveProperty('completionRate');
  });
});
