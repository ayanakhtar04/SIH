import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

let mentorAToken: string; let mentorAId: string;
let mentorBToken: string; let mentorBId: string;

async function createMentor(email: string, password: string) {
  const user = await prisma.user.create({ data: { id: crypto.randomUUID(), email, name: email.split('@')[0], role: 'mentor', passwordHash: await bcrypt.hash(password, 10) } });
  const login = await request(app).post('/api/auth/teacher/login').send({ email, password }).expect(200);
  return { token: login.body.token, id: user.id };
}

describe('Mentor scoping in /api/students', () => {
  beforeAll(async () => {
    // Use fresh mentors each run to avoid cross-test contamination
    const mA = await createMentor(`mentor.scope.a.${Date.now()}@example.edu`, 'MentorA@123');
    mentorAToken = mA.token; mentorAId = mA.id;
    const mB = await createMentor(`mentor.scope.b.${Date.now()}@example.edu`, 'MentorB@123');
    mentorBToken = mB.token; mentorBId = mB.id;

    // Seed students explicitly assigned to each mentor
    const stuA = await prisma.student.create({ data: { id: crypto.randomUUID(), studentCode: 'MSCOPA_' + Date.now(), name: 'Mentor A Student', email: `mscopa.${Date.now()}@example.edu`, mentorId: mentorAId } });
    const stuB = await prisma.student.create({ data: { id: crypto.randomUUID(), studentCode: 'MSCOPB_' + (Date.now()+1), name: 'Mentor B Student', email: `mscopb.${Date.now()}@example.edu`, mentorId: mentorBId } });
    // Unassigned student (should NOT appear for mentors now that strict filtering applied)
    await prisma.student.create({ data: { id: crypto.randomUUID(), studentCode: 'MSCOPU_' + (Date.now()+2), name: 'Unassigned Student', email: `mscupu.${Date.now()}@example.edu` } });
    // Keep created references to avoid TS unused variable removal (optional)
    if (!stuA || !stuB) throw new Error('Seeding failed');
  });

  it('mentor A only sees students assigned to them', async () => {
    const res = await request(app)
      .get('/api/students?page=1&pageSize=50')
      .set('Authorization', `Bearer ${mentorAToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    const data = res.body.data as any[];
    expect(data.length).toBeGreaterThan(0);
    data.forEach(s => {
      expect(s.mentorId).toBe(mentorAId);
    });
  });

  it('mentor B only sees students assigned to them', async () => {
    const res = await request(app)
      .get('/api/students?page=1&pageSize=50')
      .set('Authorization', `Bearer ${mentorBToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    const data = res.body.data as any[];
    expect(data.length).toBeGreaterThan(0);
    data.forEach(s => {
      expect(s.mentorId).toBe(mentorBId);
    });
  });
});
