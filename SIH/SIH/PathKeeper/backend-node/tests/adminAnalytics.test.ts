import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import { signUser } from '../src/auth/jwt';

const adminUser = { id:'admin-analytics', email:'admin-analytics@test.local', name:'AA', role:'admin', passwordHash:'x' } as any;

beforeAll(async () => {
  await prisma.user.upsert({ where:{ email: adminUser.email }, update:{}, create: adminUser });
  // seed some students to make metrics non-empty
  for (let i=0;i<3;i++) {
    await prisma.student.upsert({
      where: { email: `metric_student_${i}@example.com` },
      update: {},
      create: { id: `metric-s-${i}`, email:`metric_student_${i}@example.com`, name:`Metric Student ${i}`, studentCode:`MS${i}`, passwordHash:'', riskScore: Math.random(), createdAt: new Date() }
    });
  }
});

describe('Admin Analytics Metrics', () => {
  const token = signUser(adminUser);
  it('GET /api/admin/metrics/overview returns summary numbers', async () => {
    const res = await request(app).get('/api/admin/metrics/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.overview).toBeDefined();
    expect(typeof res.body.overview.studentsTotal).toBe('number');
  });
  it('GET /api/admin/metrics/risk-trend returns array (possibly empty)', async () => {
    const res = await request(app).get('/api/admin/metrics/risk-trend').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.trend)).toBe(true);
    if (res.body.trend.length) {
      expect(res.body.trend[0]).toHaveProperty('date');
      expect(res.body.trend[0]).toHaveProperty('avgRisk');
    }
  });
  it('GET /api/admin/metrics/interventions/effectiveness returns structure', async () => {
    const res = await request(app).get('/api/admin/metrics/interventions/effectiveness').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.effectiveness).toBeDefined();
    expect(res.body.effectiveness).toHaveProperty('totals');
  });
});
