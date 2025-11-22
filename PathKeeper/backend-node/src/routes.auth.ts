import bcrypt from 'bcryptjs';
import { Router } from 'express';

import { signUser } from './auth/jwt';
import { authRequired, AuthedRequest } from './auth/middleware';
import { userStore } from './store/userStore';

const authRouter = Router();

// Login endpoint: Accepts { email, password } and returns JWT + user summary.
// Now backed by Prisma persistence layer.
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password required', status: 400 });
  }
  // Lookup via userStore (Prisma-backed)
  let user;
  try {
    user = await userStore.getByEmail(email);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'User lookup failed', status: 500 });
  }
  if (!user) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials', status: 401 });
  }
  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: 'Password too short', status: 400 });
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials', status: 401 });
  }
  const token = signUser(user);
  return res.json({ ok: true, token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

// Basic token decode view (legacy). Keep for compatibility.
authRouter.get('/me', authRequired, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ ok:false, error:'Unauthenticated', status:401 });
    const full = await userStore.getById(req.user.id);
    if (!full) return res.status(404).json({ ok:false, error:'Not found', status:404 });
    return res.json({ ok: true, user: { id: full.id, email: full.email, role: full.role, name: full.name } });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:e.message || 'Failed', status:500 });
  }
});

// PATCH /auth/me -> update own name/email
authRouter.patch('/me', authRequired, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ ok:false, error:'Unauthenticated', status:401 });
    const { name, email } = req.body || {};
    if (!name && !email) return res.status(400).json({ ok:false, error:'Nothing to update', status:400 });
    if (name && (typeof name !== 'string' || name.trim().length < 2)) return res.status(400).json({ ok:false, error:'Invalid name', status:400 });
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok:false, error:'Invalid email', status:400 });
    if (email) {
      const existing = await userStore.getByEmail(email);
      if (existing && existing.id !== req.user.id) return res.status(409).json({ ok:false, error:'Email already used', status:409 });
    }
    const data: { name?: string; email?: string } = {};
    if (name) data.name = name.trim();
    if (email) data.email = email.trim();
    const updated = await userStore.updateProfile(req.user.id, data);
    const requireRelogin = !!email && email !== req.user.email;
    try {
      // @ts-ignore dynamic audit guard
      const prismaAny = (require('./prisma/client').prisma as any);
      if (prismaAny?.auditLog?.create) {
        prismaAny.auditLog.create({ data: { action:'self.updateProfile', actorId: req.user.id, userId: req.user.id, details: JSON.stringify({ nameChanged: !!name, emailChanged: !!email }) } }).catch(()=>{});
      }
    } catch (auditErr) {
      // swallow audit errors but attach debug hint
      (res as any)._auditErr = (auditErr as Error).message;
    }
    return res.json({ ok:true, user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role }, requireRelogin });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:e.message || 'Update failed', status:500, trace:e.stack });
  }
});

// POST /auth/me/password { currentPassword, newPassword }
authRouter.post('/me/password', authRequired, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ ok:false, error:'Unauthenticated', status:401 });
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ ok:false, error:'Missing fields', status:400 });
    if (newPassword.length < 8) return res.status(400).json({ ok:false, error:'Password too short', status:400 });
    const full = await userStore.getById(req.user.id);
    if (!full) return res.status(404).json({ ok:false, error:'Not found', status:404 });
    const match = await bcrypt.compare(currentPassword, full.passwordHash);
    if (!match) return res.status(401).json({ ok:false, error:'Current password incorrect', status:401 });
    if (await bcrypt.compare(newPassword, full.passwordHash)) return res.status(400).json({ ok:false, error:'New password must differ', status:400 });
    const newHash = await bcrypt.hash(newPassword, 10);
    await userStore.updatePassword(full.id, newHash);
    try {
      // @ts-ignore dynamic audit guard
      const prismaAny = (require('./prisma/client').prisma as any);
      if (prismaAny?.auditLog?.create) {
        prismaAny.auditLog.create({ data: { action:'self.changePassword', actorId: req.user.id, userId: req.user.id } }).catch(()=>{});
      }
    } catch (auditErr) {
      (res as any)._auditErr = (auditErr as Error).message;
    }
    return res.json({ ok:true, requireRelogin:true });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:e.message || 'Password change failed', status:500, trace:e.stack });
  }
});

export default authRouter;
