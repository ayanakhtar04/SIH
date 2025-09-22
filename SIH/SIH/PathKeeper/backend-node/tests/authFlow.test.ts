import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { prisma } from '../src/prisma/client';
import bcrypt from 'bcryptjs';

const basePassword = 'TestPass123!';
const initialEmail = `auth.user.${Date.now()}@test.local`;
let currentEmail = initialEmail; // track email after updates

beforeAll(async () => {
  const hash = await bcrypt.hash(basePassword, 10);
  await prisma.user.create({ data: { id:`authu_${Date.now()}`, email:initialEmail, name:'Auth User', role:'mentor', passwordHash: hash } });
});

describe('Auth Flow', () => {
  let token:string;
  it('login success returns token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: currentEmail, password: basePassword });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });
  it('login failure wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: currentEmail, password: 'WrongPass!' });
    expect(res.status).toBe(401);
  });
  it('/auth/me returns profile', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(currentEmail);
  });
  it('PATCH /auth/me updates name', async () => {
    const res = await request(app).patch('/api/auth/me').set('Authorization', `Bearer ${token}`).send({ name:'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Updated Name');
    expect(res.body.requireRelogin).toBe(false);
  });
  it('PATCH /auth/me changing email sets requireRelogin', async () => {
    const newEmail = `changed.${Date.now()}@test.local`;
    const res = await request(app).patch('/api/auth/me').set('Authorization', `Bearer ${token}`).send({ email: newEmail });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(newEmail);
    expect(res.body.requireRelogin).toBe(true);
    currentEmail = newEmail; // update tracked email
  });
  let newPassword='NewPass456!';
  it('rejects short new password', async () => {
    const res = await request(app).post('/api/auth/me/password').set('Authorization', `Bearer ${token}`).send({ currentPassword: basePassword, newPassword: 'short' });
    expect(res.status).toBe(400);
  });
  it('changes password successfully', async () => {
    const res = await request(app).post('/api/auth/me/password').set('Authorization', `Bearer ${token}`).send({ currentPassword: basePassword, newPassword: newPassword });
    expect(res.status).toBe(200);
    expect(res.body.requireRelogin).toBe(true);
  });
  it('login with old password fails', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: currentEmail, password: basePassword });
    expect(res.status).toBe(401);
  });
  it('login with new password succeeds', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: currentEmail, password: newPassword });
    expect(res.status).toBe(200);
  });
});
