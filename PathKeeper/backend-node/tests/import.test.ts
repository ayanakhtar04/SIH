import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function unique(base: string) { return base + Math.floor(Math.random()*1e6).toString(); }

async function ensureAdmin() {
  const email = 'admin@pathkeepers.local';
  const admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) {
    await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email,
        name: 'Platform Admin',
        role: 'admin',
        passwordHash: await bcrypt.hash('Admin@123', 10)
      }
    });
  }
}

async function createCounselor(email: string) {
  await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email,
      name: 'Counselor Temp',
      role: 'counselor',
      passwordHash: await bcrypt.hash('Mentor@123', 10)
    }
  });
}

describe('Student import', () => {
  let adminToken: string;
  let counselorToken: string;
  let csv: string;
  const counselorEmail = `counselor.import.${Date.now()}@example.edu`;

  beforeAll(async () => {
    await ensureAdmin();
    await createCounselor(counselorEmail);
    const code = unique('BULK');
    const email = `new.student+${code}@example.edu`;
    csv = `studentCode,name,email,program,year,riskScore\n${code},New Student,${email},B.Tech IT,1,0.45`;
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@pathkeepers.local', password: 'Admin@123' });
    adminToken = adminLogin.body.token;
    const counselorLogin = await request(app).post('/api/auth/login').send({ email: counselorEmail, password: 'Mentor@123' });
    counselorToken = counselorLogin.body.token;
    expect(counselorToken).toBeDefined();
  });

  it('dryRun import returns counts without creating', async () => {
    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('dryRun', 'true')
      .attach('file', Buffer.from(csv), { filename: 'students.csv', contentType: 'text/csv' });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.counts.valid).toBe(1);
    expect(res.body.counts.created).toBe(0);
  });

  it('real import creates student', async () => {
    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('dryRun', 'false')
      .attach('file', Buffer.from(csv), { filename: 'students.csv', contentType: 'text/csv' });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(false);
    expect(res.body.counts.created).toBe(1);
  });

  it('non-admin cannot import', async () => {
    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', `Bearer ${counselorToken}`)
      .field('dryRun', 'true')
      .attach('file', Buffer.from(csv), { filename: 'students.csv', contentType: 'text/csv' });
    expect(res.status).toBe(403);
  });
});
