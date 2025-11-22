import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma/client';
import { signUser, verifyToken } from './auth/jwt';
import { authRequired } from './auth/middleware';
import { deriveRiskTierFor } from './util/risk';

// Extended auth routes: student & teacher flows (sandbox integration)
// Mentor role treated as a 'user' with role 'mentor' (legacy 'teacher' still accepted for backward compatibility).

const router = Router();

// Helpers
function signStudentToken(student: any) {
  return signUser({ id: student.id, email: student.email, role: 'viewer', name: student.name } as any, { kind: 'student', expiresIn: '2h' });
}

// Student signup
router.post('/student/signup', async (req, res) => {
  const { name, email, password, studentCode } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ ok:false, error:'Missing required fields' });
  }
  if (password.length < 8) return res.status(400).json({ ok:false, error:'Password too short' });
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ ok:false, error:'Email in use' });
  let student = await prisma.student.findUnique({ where: { email } }) as any;
    const hash = await bcrypt.hash(password, 10);
    if (student) {
  if (student.passwordHash) return res.status(409).json({ ok:false, error:'Student already active' });
  student = await prisma.student.update({ where: { id: student.id }, data: { name, passwordHash: hash } as any });
    } else {
      if (studentCode) {
        const byCode = await prisma.student.findUnique({ where: { studentCode } }) as any;
        if (byCode && !byCode.passwordHash) {
          const updated = await prisma.student.update({ where: { id: byCode.id }, data: { name, email, passwordHash: hash } as any });
          const token = signStudentToken(updated);
            return res.json({ ok:true, token, student: { id: updated.id, name: updated.name, email: updated.email, studentCode: updated.studentCode } });
        } else if (byCode) {
          return res.status(409).json({ ok:false, error:'Student code already active' });
        }
      }
      const code = studentCode ?? `STU${Date.now().toString(36)}`;
  student = await prisma.student.create({ data: { name, email, studentCode: code, passwordHash: hash } as any });
    }
  const token = signStudentToken(student);
    return res.json({ ok:true, token, student: { id: student.id, name: student.name, email: student.email, studentCode: student.studentCode } });
  } catch (e) {
    return res.status(500).json({ ok:false, error:'Signup failed' });
  }
});

// Student login
router.post('/student/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok:false, error:'Email and password required' });
  try {
  const student = await prisma.student.findUnique({ where: { email } }) as any;
    if (!student || !student.passwordHash) return res.status(401).json({ ok:false, error:'Invalid credentials' });
    const match = await bcrypt.compare(password, student.passwordHash);
    if (!match) return res.status(401).json({ ok:false, error:'Invalid credentials' });
  const token = signStudentToken(student);
    return res.json({ ok:true, token, student: { id: student.id, name: student.name, email: student.email, studentCode: student.studentCode } });
  } catch {
    return res.status(500).json({ ok:false, error:'Login failed' });
  }
});

// Teacher signup (requires env flag TEACHER_OPEN_SIGNUP)
// Default-open mentor/teacher signup unless explicitly disabled via TEACHER_OPEN_SIGNUP=false
const TEACHER_OPEN = process.env.TEACHER_OPEN_SIGNUP !== 'false';
router.post('/teacher/signup', async (req, res) => {
  if (!TEACHER_OPEN) return res.status(403).json({ ok:false, error:'Mentor signup disabled' });
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ ok:false, error:'Missing fields' });
  if (password.length < 8) return res.status(400).json({ ok:false, error:'Password too short' });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ ok:false, error:'Email in use' });
    const existingStudent = await prisma.student.findUnique({ where: { email } });
    if (existingStudent) return res.status(409).json({ ok:false, error:'Email in use' });
    const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, role: 'mentor', passwordHash: hash } });
  const token = signUser(user as any, { kind: 'user', expiresIn: '2h' });
    return res.json({ ok:true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch {
    return res.status(500).json({ ok:false, error:'Signup failed' });
  }
});

// Teacher login
router.post('/teacher/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok:false, error:'Email and password required' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
  if (!user || ((user.role !== 'mentor' && user.role !== 'teacher') && user.role !== 'admin')) return res.status(401).json({ ok:false, error:'Invalid credentials' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ ok:false, error:'Invalid credentials' });
  const token = signUser(user as any, { kind: 'user', expiresIn: '2h' });
    return res.json({ ok:true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch {
    return res.status(500).json({ ok:false, error:'Login failed' });
  }
});


// Teacher protected: students summary (reuse existing list logic later). Placeholder simple list.
router.get('/teacher/students', authRequired, async (req: any, res) => {
  if (!(['mentor','teacher','admin'].includes(req.user?.role))) return res.status(403).json({ ok:false, error:'Forbidden' });
  try {
    const list = await prisma.student.findMany({ take: 50, orderBy: { createdAt: 'desc' } });
    const students = list.map(s => ({ id: s.id, name: s.name, email: s.email, studentCode: s.studentCode, risk: s.riskScore ?? null }));
    return res.json({ ok:true, students });
  } catch {
    return res.status(500).json({ ok:false, error:'Failed to load students' });
  }
});

// --- Mentor explicit routes (mirror teacher logic) ---
router.post('/mentor/signup', async (req, res) => {
  if (!TEACHER_OPEN) return res.status(403).json({ ok:false, error:'Mentor signup disabled' });
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ ok:false, error:'Missing fields' });
  if (password.length < 8) return res.status(400).json({ ok:false, error:'Password too short' });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ ok:false, error:'Email in use' });
    const existingStudent = await prisma.student.findUnique({ where: { email } });
    if (existingStudent) return res.status(409).json({ ok:false, error:'Email in use' });
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, role: 'mentor', passwordHash: hash } });
    const token = signUser(user as any, { kind: 'user', expiresIn: '2h' });
    return res.json({ ok:true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e: any) {
    // Enhanced diagnostics for 500 errors
    const meta: any = {};
    if (e && typeof e === 'object') {
      meta.name = e.name;
      meta.code = (e as any).code;
      meta.message = e.message;
      if ((e as any).meta) meta.prismaMeta = (e as any).meta;
    }
    // Attempt to identify common Prisma errors
    if (meta.code === 'P2002') {
      return res.status(409).json({ ok:false, error:'Email already exists (unique constraint)' });
    }
    console.error('mentor_signup_error', meta); // rely on central logger later
    return res.status(500).json({ ok:false, error:'Signup failed', detail: meta.code ? meta.code : undefined });
  }
});

router.post('/mentor/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok:false, error:'Email and password required' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || ((user.role !== 'mentor' && user.role !== 'teacher') && user.role !== 'admin')) return res.status(401).json({ ok:false, error:'Invalid credentials' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ ok:false, error:'Invalid credentials' });
    const token = signUser(user as any, { kind: 'user', expiresIn: '2h' });
    return res.json({ ok:true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch {
    return res.status(500).json({ ok:false, error:'Login failed' });
  }
});

router.get('/mentor/students', authRequired, async (req: any, res) => {
  if (!(['mentor','teacher','admin'].includes(req.user?.role))) return res.status(403).json({ ok:false, error:'Forbidden' });
  try {
    const list = await prisma.student.findMany({ take: 50, orderBy: { createdAt: 'desc' } });
    const students = list.map(s => ({ id: s.id, name: s.name, email: s.email, studentCode: s.studentCode, risk: s.riskScore ?? null }));
    return res.json({ ok:true, students });
  } catch {
    return res.status(500).json({ ok:false, error:'Failed to load students' });
  }
});

export default router;

// Student self data endpoint (registered after exports to keep order non-conflicting)
router.get('/student/me', authRequired, async (req: any, res) => {
  // Only viewer (student) role allowed here; others could use students list/detail endpoints.
  if (req.user?.role !== 'viewer') {
    return res.status(403).json({ ok:false, error:'Forbidden' });
  }
  try {
    const student = await prisma.student.findUnique({ where: { id: req.user.id } });
    if (!student) return res.status(404).json({ ok:false, error:'Student not found' });
    return res.json({
      ok: true,
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        studentCode: student.studentCode,
        program: student.program,
        year: student.year,
        riskScore: student.riskScore,
        riskTier: deriveRiskTierFor(student.riskScore),
        lastRiskUpdated: student.lastRiskUpdated,
        mentorId: student.mentorId,
        createdAt: student.createdAt
      }
    });
  } catch {
    return res.status(500).json({ ok:false, error:'Failed to load student' });
  }
});