import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Tests for the /api/auth/student/me endpoint (viewer role)

let studentToken: string;
let studentId: string;

describe('Student self endpoint', () => {
  beforeAll(async () => {
    // Ensure a student with password exists
    const email = 'selftest.student@example.edu';
    let student: any = await prisma.student.findUnique({ where: { email } });
    if (!student) {
      student = await prisma.student.create({
        data: {
          id: crypto.randomUUID(),
          studentCode: 'SELF1001',
          name: 'Self Test Student',
          email,
          passwordHash: await bcrypt.hash('Student@123', 10),
          riskScore: 0.42
        }
      });
    } else if (!student.passwordHash) {
      await prisma.student.update({ where: { id: student.id }, data: { passwordHash: await bcrypt.hash('Student@123', 10) } });
    }

    const loginRes = await request(app)
      .post('/api/auth/student/login')
      .send({ email, password: 'Student@123' })
      .expect(200);
    studentToken = loginRes.body.token;
    studentId = loginRes.body.student.id;
  });

  it('returns self student data with risk tier', async () => {
    const res = await request(app)
      .get('/api/auth/student/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.student.id).toBe(studentId);
    expect(res.body.student).toHaveProperty('riskScore');
    expect(['high','medium','low','unknown']).toContain(res.body.student.riskTier);
  });

  it('rejects missing auth header', async () => {
    const res = await request(app)
      .get('/api/auth/student/me')
      .expect(401);
    expect(res.body.ok).toBe(false);
  });
});
