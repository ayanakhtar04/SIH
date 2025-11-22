import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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

function makeCSV(opts: { code: string; riskScore?: string }) {
  // Purposely omit riskScore when not provided to trigger inference
  const base = 'studentCode,name,email,program,year,attendancePercent,cgpa,assignmentsCompleted,assignmentsTotal,subjects,mentorAcademicNote,riskScore';
  const row = [
    opts.code,
    'Risk Import Student',
    `risk.import.${opts.code}@example.edu`,
    'B.Tech CSE',
    '2',
    '72', // attendance
    '6.5', // cgpa
    '3', // assignmentsCompleted
    '8', // assignmentsTotal
    'Math;Physics;Chemistry',
    'Student struggling with math assignments',
    opts.riskScore ?? ''
  ].join(',');
  return base + '\n' + row;
}

async function createActiveConfig() {
  // Raw SQL ensure table + insert active config if missing
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RiskModelConfig" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "weights" TEXT NOT NULL,
    "thresholds" TEXT NOT NULL,
    "active" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
  )`);
  const rows: any[] = await prisma.$queryRawUnsafe("SELECT * FROM 'RiskModelConfig' WHERE active = 1 ORDER BY createdAt DESC LIMIT 1");
  if (!rows.length) {
    const id = crypto.randomUUID();
    await prisma.$executeRawUnsafe("INSERT INTO 'RiskModelConfig'(id, version, weights, thresholds, active, createdAt) VALUES(?, 1, ?, ?, 1, CURRENT_TIMESTAMP)", id, JSON.stringify({ attendance:0.4, gpa:0.3, assignments:0.2, notes:0.1 }), JSON.stringify({ high:0.7, medium:0.4 }));
  }
}

describe('Student import with academic metrics & risk inference', () => {
  let adminToken: string;
  const code = 'ACAD' + Math.floor(Math.random()*1e6).toString();
  let inferredScore: number | undefined;

  beforeAll(async () => {
    await ensureAdmin();
    await createActiveConfig();
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@pathkeepers.local', password: 'Admin@123' });
    adminToken = adminLogin.body.token;
  });

  it('dryRun infers riskScore from academics when missing', async () => {
    const csv = makeCSV({ code });
    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('dryRun', 'true')
      .attach('file', Buffer.from(csv), { filename: 'students_acad.csv', contentType: 'text/csv' });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.rows[0].riskScore).toBeDefined();
    inferredScore = res.body.rows[0].riskScore;
    expect(typeof inferredScore).toBe('number');
  });

  it('real import persists inferred risk and academic metrics', async () => {
    const csv = makeCSV({ code });
    const res = await request(app)
      .post('/api/students/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('dryRun', 'false')
      .attach('file', Buffer.from(csv), { filename: 'students_acad.csv', contentType: 'text/csv' });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(false);
    expect(res.body.counts.created).toBe(1);

    // Fetch student list and assert riskScore present
    const list = await prisma.student.findMany({ where: { studentCode: code } });
    expect(list.length).toBe(1);
    const student: any = list[0];
    expect(student.riskScore).toBeDefined();
    if (inferredScore != null) {
      // difference tolerance due to floating rounding
      expect(Math.abs(student.riskScore - inferredScore!)).toBeLessThan(0.0001);
    }
    // Academic columns existence (raw query PRAGMA to confirm columns added)
    const pragma: any[] = await prisma.$queryRawUnsafe("PRAGMA table_info('Student')");
    const names = pragma.map(c=> c.name);
    for (const col of ['attendancePercent','cgpa','assignmentsCompleted','assignmentsTotal','subjectsJson','mentorAcademicNote','lastAcademicUpdate']) {
      expect(names).toContain(col);
    }
  });
});
