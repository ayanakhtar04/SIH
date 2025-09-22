import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const mentorEmail = `snapshot.mentor.${Date.now()}@example.edu`;
const mentorPass = 'SnapMentor@123';
let token: string; let studentId: string;

async function ensureRiskSnapshotTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RiskSnapshot" (
    id TEXT PRIMARY KEY NOT NULL,
    studentId TEXT NOT NULL,
    riskScore REAL NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source TEXT,
    FOREIGN KEY(studentId) REFERENCES Student(id) ON DELETE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS RiskSnapshot_student_idx ON "RiskSnapshot" (studentId, createdAt)`);
}

beforeAll(async () => {
  await ensureRiskSnapshotTable();
  // Seed mentor
  await prisma.user.create({ data: { id: crypto.randomUUID(), email: mentorEmail, name: 'Snapshot Mentor', role: 'mentor', passwordHash: await bcrypt.hash(mentorPass, 10) } });
  // Seed student assigned to mentor with baseline risk
  const student = await prisma.student.create({ data: { id: crypto.randomUUID(), studentCode: 'SNAPSTU_' + Date.now(), name: 'Snapshot Student', email: `snap.student.${Date.now()}@example.edu`, mentorId: (await prisma.user.findUnique({ where: { email: mentorEmail } }))!.id, riskScore: 0.4 } });
  studentId = student.id;
  const login = await request(app).post('/api/auth/login').send({ email: mentorEmail, password: mentorPass });
  token = login.body.token;
});

describe('Risk Snapshot Creation', () => {
  it('creates a snapshot when academic update changes risk', async () => {
    const before = await prisma.$queryRawUnsafe<any[]>(`SELECT count(*) as c FROM "RiskSnapshot" WHERE studentId = ?`, studentId);
    const beforeCount = Number(before[0]?.c || 0);
    const res = await request(app)
      .patch(`/api/students/${studentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ attendancePercent: 50, cgpa: 5, assignmentsCompleted: 2, assignmentsTotal: 10 });
    expect(res.status).toBe(200);
    const after = await prisma.$queryRawUnsafe<any[]>(`SELECT count(*) as c FROM "RiskSnapshot" WHERE studentId = ?`, studentId);
    const afterCount = Number(after[0]?.c || 0);
    expect(afterCount).toBeGreaterThan(beforeCount);
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "RiskSnapshot" WHERE studentId = ? ORDER BY datetime(createdAt) DESC LIMIT 1`, studentId);
    expect(rows[0].source).toBe('academic_update');
  });
});
