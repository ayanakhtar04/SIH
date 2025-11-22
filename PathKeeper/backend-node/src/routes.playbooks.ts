import { Router } from 'express';
import { prisma } from './prisma/client';
import { authRequired, AuthedRequest } from './auth/middleware';
import { isAdmin, isMentor, isCounselor } from './auth/roles';

const router = Router();

// List playbooks (active only by default)
// GET /api/playbooks?all=1&category=Attendance
router.get('/', authRequired, async (req: AuthedRequest, res) => {
  try {
    const all = String(req.query.all||'0') === '1';
    const category = req.query.category ? String(req.query.category) : undefined;
    const where: any = {};
    if (!all) where.active = true;
    if (category) where.category = category;
    const rows = await prisma.interventionPlaybook.findMany({ where, orderBy: { createdAt: 'asc' } });
    return res.json({ ok:true, playbooks: rows });
  } catch {
    return res.status(500).json({ ok:false, error:'Failed to list playbooks' });
  }
});

// Create playbook (admin only)
router.post('/', authRequired, async (req: AuthedRequest, res) => {
  if (!isAdmin(req.user?.role)) return res.status(403).json({ ok:false, error:'Forbidden' });
  const { key, title, description, category, steps } = req.body || {};
  if (!key || !title) return res.status(400).json({ ok:false, error:'Missing key/title' });
  try {
    const created = await prisma.interventionPlaybook.create({ data: { key, title, description, category, steps } });
    return res.json({ ok:true, playbook: created });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:'Create failed' });
  }
});

// Assign playbook to student (mentor/admin/counselor)
router.post('/assign', authRequired, async (req: AuthedRequest, res) => {
  const { studentId, playbookId, notes } = req.body || {};
  if (!studentId || !playbookId) return res.status(400).json({ ok:false, error:'Missing studentId or playbookId' });
  if (!(isAdmin(req.user?.role) || isMentor(req.user?.role) || isCounselor(req.user?.role))) return res.status(403).json({ ok:false, error:'Forbidden' });
  try {
    const assignment = await prisma.studentPlaybookAssignment.create({ data: { studentId, playbookId, mentorId: req.user?.id, notes } });
    return res.json({ ok:true, assignment });
  } catch {
    return res.status(500).json({ ok:false, error:'Assign failed' });
  }
});

// List assignments for a student
router.get('/student/:studentId', authRequired, async (req: AuthedRequest, res) => {
  const { studentId } = req.params;
  if (!(isAdmin(req.user?.role) || isMentor(req.user?.role) || isCounselor(req.user?.role))) return res.status(403).json({ ok:false, error:'Forbidden' });
  try {
    const assignments = await prisma.studentPlaybookAssignment.findMany({ where: { studentId }, include: { playbook: true } });
    return res.json({ ok:true, assignments });
  } catch {
    return res.status(500).json({ ok:false, error:'Failed to load assignments' });
  }
});

// Update assignment status
router.patch('/assignment/:id/status', authRequired, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ ok:false, error:'Missing status' });
  if (!(isAdmin(req.user?.role) || isMentor(req.user?.role) || isCounselor(req.user?.role))) return res.status(403).json({ ok:false, error:'Forbidden' });
  try {
    const updated = await prisma.studentPlaybookAssignment.update({ where: { id }, data: { status, completedAt: status==='completed'? new Date(): null } });
    return res.json({ ok:true, assignment: updated });
  } catch {
    return res.status(500).json({ ok:false, error:'Update failed' });
  }
});

// Add mentor note
router.post('/notes', authRequired, async (req: AuthedRequest, res) => {
  const { studentId, note } = req.body || {};
  if (!studentId || !note) return res.status(400).json({ ok:false, error:'Missing fields' });
  if (!(isAdmin(req.user?.role) || isMentor(req.user?.role) || isCounselor(req.user?.role))) return res.status(403).json({ ok:false, error:'Forbidden' });
  try {
    const created = await prisma.mentorNote.create({ data: { studentId, note, mentorId: req.user?.id } });
    return res.json({ ok:true, note: created });
  } catch {
    return res.status(500).json({ ok:false, error:'Note add failed' });
  }
});

// List notes for a student (latest first)
router.get('/notes/:studentId', authRequired, async (req: AuthedRequest, res) => {
  const { studentId } = req.params;
  if (!(isAdmin(req.user?.role) || isMentor(req.user?.role) || isCounselor(req.user?.role))) return res.status(403).json({ ok:false, error:'Forbidden' });
  try {
    const notes = await prisma.mentorNote.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } });
    return res.json({ ok:true, notes });
  } catch {
    return res.status(500).json({ ok:false, error:'Load notes failed' });
  }
});

export default router;
