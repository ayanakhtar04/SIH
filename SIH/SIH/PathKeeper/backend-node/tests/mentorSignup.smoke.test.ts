import request from 'supertest';
import { describe, it, expect, afterAll } from 'vitest';
import { createServer } from '../src/server';
import { prisma } from '../src/prisma/client';

// Use unique email each run
const uniqueEmail = `mentor_${Date.now()}@example.com`;

describe('Mentor signup smoke', () => {
  const app = createServer();
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: uniqueEmail } });
    await prisma.$disconnect();
  });
  it('signs up a mentor and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/mentor/signup')
      .send({ name: 'Test Mentor', email: uniqueEmail, password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user?.role).toBe('mentor');
  });
});
