import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authRequired, AuthedRequest } from './auth/middleware';
import { isAdmin } from './auth/roles';
import { userStore } from './store/userStore';
import { prisma } from './prisma/client';

// NOTE: We never return password hashes to the client.
// Shape returned to frontend.
interface PublicUser { id: string; email: string; name: string; role: string; createdAt: Date; }

function toPublic(u: any): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt };
}

const usersRouter = Router();

// All endpoints require auth + admin role.
usersRouter.use(authRequired, (req: AuthedRequest, res, next) => {
  if (!isAdmin(req.user?.role)) return res.status(403).json({ ok:false, error:'Forbidden', status:403 });
  next();
});

// List users with pagination & search
usersRouter.get('/', async (req, res) => {
  try {
    const role = (req.query.role as string) || undefined;
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = Math.min(100, parseInt((req.query.pageSize as string) || '25', 10));
    const search = (req.query.search as string) || undefined;
    const skip = (page - 1) * pageSize;
    const { users, total } = await userStore.list({ skip, take: pageSize, role, search });
    return res.json({ ok:true, users: users.map(toPublic), page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:e.message || 'List failed', status:500 });
  }
});

// Export CSV (role/search filters)
usersRouter.get('/export.csv', async (req, res) => {
  try {
    const role = (req.query.role as string) || undefined;
    const search = (req.query.search as string) || undefined;
    const { users } = await userStore.list({ skip:0, take:10000, role, search });
    const header = 'id,name,email,role,createdAt';
    const lines = users.map(u => `${u.id},"${u.name.replace(/"/g,'""')}",${u.email},${u.role},${u.createdAt.toISOString()}`);
    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users_export.csv"');
    return res.send(csv);
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:e.message || 'Export failed', status:500 });
  }
});

// Create user { email, name, role, password }
usersRouter.post('/', async (req, res) => {
  const { email, name, role, password } = req.body || {};
  if (!email || !name || !role || !password) return res.status(400).json({ ok:false, error:'Missing fields', status:400 });
  if (password.length < 8) return res.status(400).json({ ok:false, error:'Password too short', status:400 });
  const allowedRoles = ['admin','counselor','viewer','mentor'];
  if (!allowedRoles.includes(role)) return res.status(400).json({ ok:false, error:'Invalid role', status:400 });
  try {
    const existing = await userStore.getByEmail(email);
    if (existing) return res.status(409).json({ ok:false, error:'Email already exists', status:409 });
    const user = await userStore.add({
      id: crypto.randomUUID(),
      email,
      name,
      role,
      passwordHash: await bcrypt.hash(password, 10)
    });
  // Audit log (may require prisma generate after adding model)
  // @ts-ignore - auditLog added in schema
  if ((prisma as any).auditLog) await (prisma as any).auditLog.create({ data: { action:'user.create', actorId: (req as AuthedRequest).user?.id, userId: user.id, details: JSON.stringify({ email, role }) } });
    return res.status(201).json({ ok:true, user: toPublic(user) });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:e.message || 'Create failed', status:500 });
  }
});

// Delete user by id
usersRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await userStore.getById(id);
    if (!existing) return res.status(404).json({ ok:false, error:'Not found', status:404 });
    // Optional: prevent self-delete to avoid lockout
    if (existing.role === 'admin') {
      // Count remaining admins: simple re-list filter
      const { users: adminUsers } = await userStore.list({ role: 'admin', take: 1000 });
      if (adminUsers.length <= 1 && existing.role === 'admin') return res.status(400).json({ ok:false, error:'Cannot delete last admin', status:400 });
    }
    await userStore.delete(id);
    // @ts-ignore
    if ((prisma as any).auditLog) await (prisma as any).auditLog.create({ data: { action:'user.delete', actorId: (req as AuthedRequest).user?.id, userId: id } });
    return res.json({ ok:true, deletedId: id });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:e.message || 'Delete failed', status:500 });
  }
});

// Reset password { password }
usersRouter.post('/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};
  if (!password || password.length < 8) return res.status(400).json({ ok:false, error:'Password too short', status:400 });
  try {
    const existing = await userStore.getById(id);
    if (!existing) return res.status(404).json({ ok:false, error:'Not found', status:404 });
    const hash = await bcrypt.hash(password, 10);
  await userStore.updatePassword(id, hash);
  // @ts-ignore
  if ((prisma as any).auditLog) await (prisma as any).auditLog.create({ data: { action:'user.resetPassword', actorId: (req as AuthedRequest).user?.id, userId: id } });
    return res.json({ ok:true, id });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:e.message || 'Reset failed', status:500 });
  }
});

// Change role
usersRouter.patch('/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body || {};
  const allowedRoles = ['admin','counselor','viewer','mentor'];
  if (!role || !allowedRoles.includes(role)) return res.status(400).json({ ok:false, error:'Invalid role', status:400 });
  try {
    const existing = await userStore.getById(id);
    if (!existing) return res.status(404).json({ ok:false, error:'Not found', status:404 });
  await userStore.updateRole(id, role);
  // @ts-ignore
  if ((prisma as any).auditLog) await (prisma as any).auditLog.create({ data: { action:'user.updateRole', actorId: (req as AuthedRequest).user?.id, userId: id, details: JSON.stringify({ from: existing.role, to: role }) } });
    return res.json({ ok:true, id, role });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:e.message || 'Role update failed', status:500 });
  }
});

// List audit logs (basic pagination)
usersRouter.get('/audit/logs', async (req, res) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = Math.min(200, parseInt((req.query.pageSize as string) || '50', 10));
    const skip = (page-1)*pageSize;
    // @ts-ignore
    if (!(prisma as any).auditLog) return res.json({ ok:true, logs: [], page, pageSize, total: 0, totalPages: 0 });
    const [rows, total] = await Promise.all([
      // @ts-ignore
      (prisma as any).auditLog.findMany({ orderBy:{ createdAt:'desc' }, skip, take: pageSize }),
      // @ts-ignore
      (prisma as any).auditLog.count()
    ]);
    return res.json({ ok:true, logs: rows, page, pageSize, total, totalPages: Math.ceil(total/pageSize) });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:e.message || 'Audit list failed', status:500 });
  }
});

export default usersRouter;