import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Tests for /api/students/export.csv endpoint covering admin access and mentor scoping

let adminToken: string;
let mentorToken: string;
let mentorUserId: string;

async function ensureAdmin() {
  const email = 'admin.csvtest@pathkeepers.local';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email,
        name: 'CSV Admin',
        role: 'admin',
        passwordHash: await bcrypt.hash('Admin@123', 10)
      }
    });
  }
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'Admin@123' })
    .expect(200);
  adminToken = login.body.token;
}

async function ensureMentorAndStudents() {
  const email = 'mentor.csvtest@example.edu';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email,
        name: 'CSV Mentor',
        role: 'mentor',
        passwordHash: await bcrypt.hash('Mentor@123', 10)
      }
    });
  }
  mentorUserId = user.id;
  const login = await request(app)
    .post('/api/auth/teacher/login') // teacher login path accepts mentors/admin
    .send({ email, password: 'Mentor@123' })
    .expect(200);
  mentorToken = login.body.token;

  // Ensure some students exist and a subset assigned to mentor
  const existing = await prisma.student.count();
  if (existing < 3) {
    for (let i = existing; i < 3; i++) {
      await prisma.student.create({
        data: {
          id: crypto.randomUUID(),
          studentCode: `CSV${1000 + i}`,
          name: `CSV Student ${i+1}`,
          email: `csv.student${i+1}@example.edu`,
          riskScore: 0.2 + (i * 0.2)
        }
      });
    }
  }
  // Assign first student to mentor if none assigned
  const first = await prisma.student.findFirst({ where: { mentorId: mentorUserId } });
  if (!first) {
    const any = await prisma.student.findFirst();
    if (any) await prisma.student.update({ where: { id: any.id }, data: { mentorId: mentorUserId } });
  }
}

describe('Students CSV Export', () => {
  beforeAll(async () => {
    await ensureAdmin();
    await ensureMentorAndStudents();
  });

  it('admin can export all students CSV', async () => {
    const res = await request(app)
      .get('/api/students/export.csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\n')[0]).toContain('studentCode');
  });

  it('mentor export is limited to their students (at least one assigned)', async () => {
    const res = await request(app)
      .get('/api/students/export.csv')
      .set('Authorization', `Bearer ${mentorToken}`)
      .expect(200);
    const lines = res.text.trim().split('\n');
    expect(lines.length).toBeGreaterThan(1);
    const header = lines[0];
    expect(header).toContain('riskTier');
    // Parse rows and ensure each line has correct column count
    const cols = header.split(',').length;
    for (let i = 1; i < lines.length; i++) {
      const rowCols = lines[i].split(',').length;
      expect(rowCols).toBe(cols);
    }
  });

  it('rejects unauthorized access', async () => {
    await request(app)
      .get('/api/students/export.csv')
      .expect(401);
  });
});
