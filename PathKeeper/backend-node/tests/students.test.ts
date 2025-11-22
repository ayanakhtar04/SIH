import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Minimal integration tests for student listing and detail

let token: string;
let firstStudentId: string | undefined;

describe('Students API', () => {
  beforeAll(async () => {
    // Ensure at least one user and one student exist
    const adminEmail = 'admin@pathkeepers.local';
    let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: adminEmail,
          name: 'Platform Admin',
          role: 'admin',
          passwordHash: await bcrypt.hash('Admin@123', 10)
        }
      });
    }

    const studentCount = await prisma.student.count();
    if (studentCount === 0) {
      await prisma.student.create({
        data: {
          id: crypto.randomUUID(),
          studentCode: 'TST1000',
          name: 'Test Student',
          email: 'test.student@example.edu',
          riskScore: 0.5
        }
      });
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'Admin@123' })
      .expect(200);
    token = loginRes.body.token;
  });

  it('lists students', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length) {
      firstStudentId = res.body.data[0].id;
    }
  });

  it('fetches student detail', async () => {
    if (!firstStudentId) {
      const list = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      firstStudentId = list.body.data[0]?.id;
    }
    if (!firstStudentId) return; // Skip if still no student

    const res = await request(app)
      .get(`/api/students/${firstStudentId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.student.id).toBe(firstStudentId);
  });

  it('returns 404 for unknown student', async () => {
    const res = await request(app)
      .get('/api/students/non-existent-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(res.body.ok).toBe(false);
  });
});
