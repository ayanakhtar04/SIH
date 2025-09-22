import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import { signUser } from '../src/auth/jwt';

// We'll use raw SQL fallback columns (academic fields) assuming migration raw executed externally.

const admin = { id:'u-admin-su', email:'admin-su@test.local', name:'AdminSU', role:'admin', passwordHash:'x' } as any;
const mentor = { id:'u-mentor-su', email:'mentor-su@test.local', name:'MentorSU', role:'mentor', passwordHash:'x' } as any;
const otherMentor = { id:'u-mentor2-su', email:'mentor2-su@test.local', name:'Mentor2SU', role:'mentor', passwordHash:'x' } as any;
let studentId: string;

beforeAll(async () => {
  await prisma.user.upsert({ where:{ email: admin.email }, update:{}, create: admin });
  await prisma.user.upsert({ where:{ email: mentor.email }, update:{}, create: mentor });
  await prisma.user.upsert({ where:{ email: otherMentor.email }, update:{}, create: otherMentor });
  const email = `student.update+${Date.now()}@test.local`;
  await prisma.student.deleteMany({ where:{ email: { contains:'student.update@', mode:'insensitive' } as any } }).catch(()=>{});
  const created = await prisma.student.create({ data: { id:`stu_${Date.now()}`, studentCode:`SCODE_${Date.now()}`, name:'Student Update', email, mentorId: mentor.id } });
  studentId = created.id;
});

describe('Student academic update', () => {
  const adminToken = signUser(admin);
  const mentorToken = signUser(mentor);
  const otherMentorToken = signUser(otherMentor);

  it('Mentor can update own student and risk recalculates', async () => {
    const res = await request(app)
      .patch(`/api/students/${studentId}`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ attendancePercent: 80, cgpa: 7.5, assignmentsCompleted: 8, assignmentsTotal: 10, mentorAcademicNote: 'Student is doing fine' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.student.riskScore).toBeDefined();
    expect(res.body.student.riskTier).toBeDefined();
  });

  it('Other mentor cannot update student not assigned to them', async () => {
    const res = await request(app)
      .patch(`/api/students/${studentId}`)
      .set('Authorization', `Bearer ${otherMentorToken}`)
      .send({ attendancePercent: 50 });
    expect(res.status).toBe(403);
  });

  it('Admin can update any student', async () => {
    const res = await request(app)
      .patch(`/api/students/${studentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attendancePercent: 90, mentorAcademicNote: 'Improved performance, fewer absences' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('Rejects empty payload', async () => {
    const res = await request(app)
      .patch(`/api/students/${studentId}`)
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
