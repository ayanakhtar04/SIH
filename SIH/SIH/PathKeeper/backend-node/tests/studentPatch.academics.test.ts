import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import { signUser } from '../src/auth/jwt';

// Focused regression test for PATCH academic metrics & risk recompute after fallback bug fix.

describe('PATCH /api/students/:id academic metrics', () => {
  const admin = { id:'u-admin-spa', email:'admin-spa@test.local', name:'AdminSPA', role:'admin', passwordHash:'x' } as any;
  const mentor = { id:'u-mentor-spa', email:'mentor-spa@test.local', name:'MentorSPA', role:'mentor', passwordHash:'x' } as any;
  let studentId: string;
  let mentorToken: string; let adminToken: string;

  beforeAll(async () => {
    await prisma.user.upsert({ where:{ email: admin.email }, update:{}, create: admin });
    await prisma.user.upsert({ where:{ email: mentor.email }, update:{}, create: mentor });
    const created = await prisma.student.create({ data: { id:`stu_patch_${Date.now()}`, studentCode:`STPATCH_${Date.now()}`, name:'Patch Target', email:`patch.target.${Date.now()}@test.local`, mentorId: mentor.id } });
    studentId = created.id;
    mentorToken = signUser(mentor);
    adminToken = signUser(admin);
  });

  it('Mentor patch sets metrics and returns updated risk', async () => {
    const res = await request(app)
      .patch(`/api/students/${studentId}`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ attendancePercent: 88, cgpa: 7.2, assignmentsCompleted: 6, assignmentsTotal: 9, mentorAcademicNote: 'Struggling in physics labs' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.student.riskScore).toBe('number');
    expect(res.body.student.riskTier).toBeDefined();
  });

  it('Subsequent patch with only note still succeeds and may adjust risk', async () => {
    const first = await prisma.student.findUnique({ where:{ id: studentId } });
    const prevRisk = first?.riskScore;
    const res = await request(app)
      .patch(`/api/students/${studentId}`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ mentorAcademicNote: 'fail pattern emerging in weekly quizzes' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Risk can go up due to note penalty if pattern words present
    expect(typeof res.body.student.riskScore).toBe('number');
    if (prevRisk != null) {
      // cannot assert strictly greater due to weight interactions, but value should be finite
      expect(isFinite(res.body.student.riskScore)).toBe(true);
    }
  });

  it('Admin can patch single field (attendancePercent) without affecting others', async () => {
    const before = await prisma.student.findUnique({ where:{ id: studentId } }) as any;
    const res = await request(app)
      .patch(`/api/students/${studentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attendancePercent: 92 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const after = await prisma.student.findUnique({ where:{ id: studentId } }) as any;
    expect(after.attendancePercent).toBe(92);
    expect(after.cgpa).toBe(before.cgpa); // unchanged
  });

  it('Rejects when no valid fields provided', async () => {
    const res = await request(app)
      .patch(`/api/students/${studentId}`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ irrelevant: 123 });
    expect(res.status).toBe(400);
  });
});
