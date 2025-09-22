import { Router } from 'express';
import { prisma } from './prisma/client';
import { authRequired, AuthedRequest } from './auth/middleware';
import { isAdmin, isCounselor, isMentor } from './auth/roles';

const router = Router();

// List upcoming + recent meetings for a student (next 30 days & last 7 days)
router.get('/student/:studentId', authRequired, async (req: AuthedRequest, res) => {
  const { studentId } = req.params;
  if (!(isAdmin(req.user?.role) || isMentor(req.user?.role) || isCounselor(req.user?.role))) {
    return res.status(403).json({ ok:false, error:'Forbidden' });
  }
  const now = new Date();
  const pastWindow = new Date(now.getTime() - 7*24*60*60*1000);
  const futureWindow = new Date(now.getTime() + 30*24*60*60*1000);
  try {
    const meetings = await prisma.meeting.findMany({
      where: { studentId, OR:[ { startsAt: { gte: pastWindow, lte: futureWindow } } ] },
      orderBy: { startsAt: 'asc' }
    });
    return res.json({ ok:true, meetings });
  } catch {
    return res.status(500).json({ ok:false, error:'Failed to list meetings' });
  }
});

// Create meeting
router.post('/', authRequired, async (req: AuthedRequest, res) => {
  if (!(isAdmin(req.user?.role) || isMentor(req.user?.role) || isCounselor(req.user?.role))) {
    return res.status(403).json({ ok:false, error:'Forbidden' });
  }
  const { studentId, title, startsAt, endsAt, location, notes } = req.body || {};
  if (!studentId || !title || !startsAt || !endsAt) return res.status(400).json({ ok:false, error:'Missing required fields' });
  try {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ ok:false, error:'Invalid time range' });
    }
    const meeting = await prisma.meeting.create({ data: { studentId, mentorId: req.user?.id, title, startsAt: start, endsAt: end, location, notes } });
    return res.json({ ok:true, meeting });
  } catch {
    return res.status(500).json({ ok:false, error:'Create failed' });
  }
});

// Cancel meeting
router.patch('/:id/cancel', authRequired, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  if (!(isAdmin(req.user?.role) || isMentor(req.user?.role) || isCounselor(req.user?.role))) {
    return res.status(403).json({ ok:false, error:'Forbidden' });
  }
  try {
    const existing = await prisma.meeting.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ ok:false, error:'Not found' });
    if (existing.status === 'cancelled') return res.json({ ok:true, meeting: existing });
    const updated = await prisma.meeting.update({ where: { id }, data: { status: 'cancelled' } });
    return res.json({ ok:true, meeting: updated });
  } catch {
    return res.status(500).json({ ok:false, error:'Cancel failed' });
  }
});

export default router;
