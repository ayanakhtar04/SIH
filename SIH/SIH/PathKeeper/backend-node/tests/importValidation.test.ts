import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

let adminToken: string;

async function ensureAdmin() {
  const email = 'admin.importval@pathkeepers.local';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { id: crypto.randomUUID(), email, name: 'Import Admin', role: 'admin', passwordHash: await bcrypt.hash('Admin@123', 10) } });
  }
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Admin@123' }).expect(200);
  adminToken = login.body.token;
}

describe('CSV Import validation', () => {
  beforeAll(async () => { await ensureAdmin(); });

  it('detects duplicate email and invalid year/riskScore', async () => {
    const csv = [
      'studentCode,name,email,program,year,riskScore',
      'DUP1001,Alpha,dup.email@example.edu,B.Tech,2,0.5',
      'DUP1002,Beta,dup.email@example.edu,B.Tech,99,1.2',
      'DUP1001,Gamma,third.email@example.edu,B.Tech,-1,-0.1'
    ].join('\n');
    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'text/csv')
      .send(csv)
      .expect(200);
    expect(res.body.counts.total).toBe(3);
    expect(res.body.errors.length).toBeGreaterThan(0);
    // Ensure duplicate and invalid markers present
    const messages = res.body.errors.map((e:any)=> e.error);
    expect(messages.some((m:string)=> m.includes('Duplicate email'))).toBe(true);
    expect(messages.some((m:string)=> m.includes('Duplicate studentCode'))).toBe(true);
    expect(messages.some((m:string)=> m.includes('Invalid year'))).toBe(true);
    expect(messages.some((m:string)=> m.includes('Invalid riskScore'))).toBe(true);
  });
});
