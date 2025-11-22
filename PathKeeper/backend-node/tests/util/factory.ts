import { prisma } from '../../src/prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function createUser(opts: { role: string; email?: string; password?: string; name?: string }) {
  const email = opts.email || `${opts.role}.${Date.now()}@example.edu`;
  const password = opts.password || 'Passw0rd@123';
  const user = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email,
      name: opts.name || email.split('@')[0],
      role: opts.role,
      passwordHash: await bcrypt.hash(password, 10)
    }
  });
  return { user, password };
}

export async function createStudent(opts: { mentorId?: string; riskScore?: number }) {
  const stu = await prisma.student.create({
    data: {
      id: crypto.randomUUID(),
      studentCode: 'STU_' + crypto.randomUUID().slice(0,8),
      name: 'Student ' + Date.now(),
      email: `student.${Date.now()}_${Math.floor(Math.random()*1e5)}@example.edu`,
      mentorId: opts.mentorId || null,
      riskScore: opts.riskScore ?? null,
      lastRiskUpdated: opts.riskScore != null ? new Date() : null
    }
  });
  return stu;
}
