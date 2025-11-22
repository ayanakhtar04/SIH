import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function ensureAdminUnified() {
  const email = 'admin@pathkeepers.local';
  let admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email,
        name: 'Platform Admin',
        role: 'admin',
        passwordHash: await bcrypt.hash('Admin@123', 10)
      }
    });
  }
  return { email, password: 'Admin@123' };
}

async function getAdminToken(app: any) {
  const { email, password } = await ensureAdminUnified();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.token as string;
}

function unique(codeBase: string) {
  return codeBase + Math.floor(Math.random() * 1e6).toString();
}

describe('Raw text/csv import fallback', () => {
  const app = createServer();

  it('accepts raw text/csv body in dryRun (default) mode', async () => {
    const token = await getAdminToken(app);
    const c1 = unique('S9001');
    const c2 = unique('S9002');
    const csv = `studentCode,name,email,program,year\n${c1},Test User 1,testuser1+${c1}@example.com,Science,1\n${c2},Test User 2,testuser2+${c2}@example.com,Arts,2`;
    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/csv')
      .send(csv);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.counts.total).toBe(2);
    expect(res.body.errors.length).toBe(0);
  });

  it('persists when dryRun=false via query param', async () => {
    const token = await getAdminToken(app);
    const c = unique('S9101');
    const csv = `studentCode,name,email,program,year\n${c},Real User 1,realuser1+${c}@example.com,Science,1`;
    const res = await request(app)
      .post('/api/students/import?dryRun=false')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/csv')
      .send(csv);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.dryRun).toBe(false);
    expect(res.body.counts.created).toBe(1);

    const student = await prisma.student.findFirst({ where: { studentCode: c } });
    expect(student).not.toBeNull();
  });
});
