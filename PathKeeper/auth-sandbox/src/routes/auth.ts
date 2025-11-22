import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev';
const STUDENT_MIN_PASS = 8;

function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

// Schemas
const studentSignupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(STUDENT_MIN_PASS),
  studentCode: z.string().optional()
});
const studentLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

const teacherSignupSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8) });
const teacherLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

// Student signup
authRouter.post('/student/signup', async (req: Request, res: Response) => {
  const parsed = studentSignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok:false, error: parsed.error.flatten() });
  const { name, email, password, studentCode } = parsed.data;
  try {
    // Check uniqueness across both tables
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ ok:false, error:'Email in use' });

    let student = await prisma.student.findUnique({ where: { email } });
    if (student && student.passwordHash) return res.status(409).json({ ok:false, error:'Student already activated' });

    const hash = await bcrypt.hash(password, 10);
    if (student) {
      student = await prisma.student.update({ where: { id: student.id }, data: { passwordHash: hash, name } });
    } else {
      // allow matching by provided studentCode if exists
      if (studentCode) {
        const byCode = await prisma.student.findUnique({ where: { studentCode } });
        if (byCode && !byCode.passwordHash) {
          const updated = await prisma.student.update({ where: { id: byCode.id }, data: { passwordHash: hash, name, email } });
          const token = signToken({ sub: updated.id, kind: 'student' });
          return res.json({ ok:true, token, student: { id: updated.id, name: updated.name, email: updated.email, studentCode: updated.studentCode } });
        } else if (byCode) {
          return res.status(409).json({ ok:false, error:'Student code already active' });
        }
      }
      const code = studentCode ?? `STU${Date.now().toString(36)}`;
      student = await prisma.student.create({ data: { name, email, studentCode: code, passwordHash: hash } });
    }
    const token = signToken({ sub: student.id, kind: 'student' });
    return res.json({ ok:true, token, student: { id: student.id, name: student.name, email: student.email, studentCode: student.studentCode } });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:'Signup failed' });
  }
});

// Student login
authRouter.post('/student/login', async (req: Request, res: Response) => {
  const parsed = studentLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok:false, error: parsed.error.flatten() });
  const { email, password } = parsed.data;
  try {
    const student = await prisma.student.findUnique({ where: { email } });
    if (!student || !student.passwordHash) return res.status(401).json({ ok:false, error:'Invalid credentials' });
    const match = await bcrypt.compare(password, student.passwordHash);
    if (!match) return res.status(401).json({ ok:false, error:'Invalid credentials' });
    const token = signToken({ sub: student.id, kind: 'student' });
    return res.json({ ok:true, token, student: { id: student.id, name: student.name, email: student.email, studentCode: student.studentCode } });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:'Login failed' });
  }
});

// Teacher signup (restricted by default: disable via env flag TEACHER_OPEN_SIGNUP)
const TEACHER_OPEN = process.env.TEACHER_OPEN_SIGNUP === 'true';
authRouter.post('/teacher/signup', async (req: Request, res: Response) => {
  if (!TEACHER_OPEN) return res.status(403).json({ ok:false, error:'Teacher signup disabled' });
  const parsed = teacherSignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok:false, error: parsed.error.flatten() });
  const { name, email, password } = parsed.data;
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ ok:false, error:'Email in use' });
    const studentExists = await prisma.student.findUnique({ where: { email } });
    if (studentExists) return res.status(409).json({ ok:false, error:'Email in use' });
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, role: 'teacher', passwordHash: hash } });
    const token = signToken({ sub: user.id, kind: 'user', role: 'teacher' });
    return res.json({ ok:true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch {
    return res.status(500).json({ ok:false, error:'Signup failed' });
  }
});

// Teacher login
authRouter.post('/teacher/login', async (req: Request, res: Response) => {
  const parsed = teacherLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok:false, error: parsed.error.flatten() });
  const { email, password } = parsed.data;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return res.status(401).json({ ok:false, error:'Invalid credentials' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ ok:false, error:'Invalid credentials' });
    const token = signToken({ sub: user.id, kind: 'user', role: user.role });
    return res.json({ ok:true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch {
    return res.status(500).json({ ok:false, error:'Login failed' });
  }
});

// /me endpoint (decode token)
authRouter.get('/me', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ ok:false, error:'Missing token' });
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return res.json({ ok:true, principal: decoded });
  } catch {
    return res.status(401).json({ ok:false, error:'Invalid token' });
  }
});

// Teacher protected: list students (mock subset). In real integration we'll join DB.
authRouter.get('/teacher/students', async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ ok:false, error:'Missing token' });
  try {
    const token = auth.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.kind !== 'user' || !(decoded.role === 'teacher' || decoded.role === 'admin')) {
      return res.status(403).json({ ok:false, error:'Forbidden' });
    }
    // Pull top 20 students from DB (id,name,email,attendance placeholder derived) else mock
    let list = await prisma.student.findMany({ take: 20, orderBy: { id: 'asc' } });
    if (!list.length) {
      list = Array.from({ length: 10 }, (_, i) => ({ id: i+1, name: `Student ${i+1}`, email: `student${i+1}@example.com`, studentCode: `STU${i+1}`, passwordHash: null } as any));
    }
    const students = list.map((s: any) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      attendance: 80 + ((s.id * 7) % 15),
      risk: (s.id * 13) % 95
    }));
    return res.json({ ok:true, students });
  } catch (e) {
    return res.status(500).json({ ok:false, error:'Failed to load students' });
  }
});

export { authRouter };
