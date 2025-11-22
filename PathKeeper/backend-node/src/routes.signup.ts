import { Router } from 'express';
import { prisma } from './prisma/client';
import { isAdmin } from './auth/roles';
import { authRequired, AuthedRequest } from './auth/middleware';
import crypto from 'crypto';

// Student invite + token-based activation flow
// Admin creates invite tokens for pre-created students (from bulk upload) or on the fly.
// Student hits /api/signup/student/verify/:token to fetch locked fields, then POST complete with password & extra profile data.

const router = Router();

// POST /api/signup/student/invite  { studentCode,email,name,expiresMinutes? }
router.post('/student/invite', authRequired, async (req: AuthedRequest, res) => {
  if (!isAdmin(req.user?.role)) return res.status(403).json({ ok:false, error:'Forbidden' });
  const { studentCode, email, name, expiresMinutes = 60 } = req.body || {};
  if (!studentCode || !email || !name) return res.status(400).json({ ok:false, error:'Missing required fields' });
  try {
    let student = await prisma.student.findUnique({ where: { studentCode } });
    if (!student) {
      student = await prisma.student.create({ data: { studentCode, email, name } });
    } else if (student.passwordHash) {
      return res.status(409).json({ ok:false, error:'Student already activated' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + Math.max(5, Math.min(1440, Number(expiresMinutes))) * 60_000);
    await prisma.signupToken.create({ data: { token, studentId: student.id, expiresAt } });
    // TODO: integrate email service here. For now return token for manual sending.
    return res.json({ ok:true, token, expiresAt });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:'Invite failed' });
  }
});

// GET /api/signup/student/verify/:token
router.get('/student/verify/:token', async (req, res) => {
  const { token } = req.params;
  const row = await prisma.signupToken.findUnique({ where: { token }, include: { student: true } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return res.status(400).json({ ok:false, error:'Invalid or expired token' });
  const { student } = row;
  return res.json({ ok:true, student: { studentCode: student.studentCode, name: student.name, email: student.email } });
});

// POST /api/signup/student/complete  { token,password,phone,guardianName,guardianEmail,guardianPhone }
import bcrypt from 'bcryptjs';
router.post('/student/complete', async (req, res) => {
  const { token, password, phone, guardianName, guardianEmail, guardianPhone } = req.body || {};
  if (!token || !password) return res.status(400).json({ ok:false, error:'Missing token or password' });
  const row = await prisma.signupToken.findUnique({ where: { token }, include: { student: true } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return res.status(400).json({ ok:false, error:'Invalid or expired token' });
  if (row.student.passwordHash) return res.status(409).json({ ok:false, error:'Already activated' });
  try {
    const hash = await bcrypt.hash(password, 10);
    await prisma.$transaction(async tx => {
      await tx.student.update({ where: { id: row.studentId }, data: {
        passwordHash: hash,
        phone: phone || undefined,
        guardianName: guardianName || undefined,
        guardianEmail: guardianEmail || undefined,
        guardianPhone: guardianPhone || undefined,
        acceptedTermsAt: new Date()
      } as any }); // cast any until prisma client regenerated
      await tx.signupToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    });
    return res.json({ ok:true });
  } catch {
    return res.status(500).json({ ok:false, error:'Activation failed' });
  }
});

export default router;
