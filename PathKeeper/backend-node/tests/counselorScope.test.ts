import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

let counselorToken: string;
let foreignStudentId: string | undefined;
let ownedStudentId: string | undefined;

const counselorEmail = `counselor.scope.${Date.now()}@example.edu`;
const counselorPassword = 'Couns3lor@123';

async function seedData() {
  // Create counselor user (role=counselor)
  await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email: counselorEmail,
      name: 'Scope Counselor',
      role: 'counselor',
      passwordHash: await bcrypt.hash(counselorPassword, 10)
    }
  });
  // Create owned + foreign students
  const owned = await prisma.student.create({
    data: {
      id: crypto.randomUUID(),
      studentCode: 'SCOPEDOWNED_' + Date.now(),
      name: 'Scope Owned',
      email: `scope.owned.${Date.now()}@example.edu`,
      mentorId: (await prisma.user.findUnique({ where: { email: counselorEmail } }))!.id
    }
  });
  const foreign = await prisma.student.create({
    data: {
      id: crypto.randomUUID(),
      studentCode: 'SCOPEFOREIGN_' + Date.now(),
      name: 'Scope Foreign',
      email: `scope.foreign.${Date.now()}@example.edu`
    }
  });
  ownedStudentId = owned.id;
  foreignStudentId = foreign.id;
}

describe('Counselor scoping', () => {
  beforeAll(async () => {
    await seedData();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: counselorEmail, password: counselorPassword })
      .expect(200);
    counselorToken = login.body.token;
  });

  it('lists only owned students for counselor', async () => {
    const list = await request(app)
      .get('/api/students?pageSize=200')
      .set('Authorization', `Bearer ${counselorToken}`)
      .expect(200);
    const all = list.body.data;
    // Ensure at least one owned present and none unowned appear
    expect(all.some((s: any) => s.id === ownedStudentId)).toBe(true);
    expect(all.some((s: any) => s.id === foreignStudentId)).toBe(false);
  });

  it('forbids access to non-owned student detail', async () => {
    if (!foreignStudentId) throw new Error('missing foreign student');
    await request(app)
      .get(`/api/students/${foreignStudentId}`)
      .set('Authorization', `Bearer ${counselorToken}`)
      .expect(403);
  });
});
