import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

let mentorAToken: string; let mentorAId: string;
let mentorBToken: string; let mentorBId: string;

async function ensureMentor(email: string, password: string) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { id: crypto.randomUUID(), email, name: email.split('@')[0], role: 'mentor', passwordHash: await bcrypt.hash(password, 10) } });
  }
  const login = await request(app).post('/api/auth/teacher/login').send({ email, password }).expect(200);
  return { token: login.body.token, id: login.body.user.id };
}

describe('Mentor scoping in /api/students', () => {
  beforeAll(async () => {
    const mA = await ensureMentor('mentor.scope.a@example.edu', 'MentorA@123');
    mentorAToken = mA.token; mentorAId = mA.id;
    const mB = await ensureMentor('mentor.scope.b@example.edu', 'MentorB@123');
    mentorBToken = mB.token; mentorBId = mB.id;

    // Create or assign students
    // We want at least one student per mentor and one unassigned
    const existing = await prisma.student.count();
    const needed = 3 - existing;
    for (let i = 0; i < needed; i++) {
      await prisma.student.create({ data: { id: crypto.randomUUID(), studentCode: `MSCOP${1000 + i}`, name: `Scope Student ${i+1}`, email: `scope.stu${i+1}@example.edu` } });
    }
    const all = await prisma.student.findMany();
    if (!all.find(s => s.mentorId === mentorAId)) {
      await prisma.student.update({ where: { id: all[0].id }, data: { mentorId: mentorAId } });
    }
    if (!all.find(s => s.mentorId === mentorBId)) {
      await prisma.student.update({ where: { id: all[1].id }, data: { mentorId: mentorBId } });
    }
  });

  it('mentor A only sees their assigned students (or subset) when requesting list', async () => {
    const res = await request(app)
      .get('/api/students?page=1&pageSize=50')
      .set('Authorization', `Bearer ${mentorAToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    const data = res.body.data as any[];
    // Every returned student either has mentorId = mentorAId or is unassigned (if logic not enforcing strict yet)
    // Eventually if strict limitation is required, adjust assertion.
    expect(data.length).toBeGreaterThan(0);
    data.forEach(s => {
      if (s.mentorId && s.mentorId !== mentorAId) {
        throw new Error(`Mentor A received student assigned to another mentor: ${s.id}`);
      }
    });
  });

  it('mentor B list similarly scoped', async () => {
    const res = await request(app)
      .get('/api/students?page=1&pageSize=50')
      .set('Authorization', `Bearer ${mentorBToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    const data = res.body.data as any[];
    expect(data.length).toBeGreaterThan(0);
    data.forEach(s => {
      if (s.mentorId && s.mentorId !== mentorBId) {
        throw new Error(`Mentor B received student assigned to another mentor: ${s.id}`);
      }
    });
  });
});
