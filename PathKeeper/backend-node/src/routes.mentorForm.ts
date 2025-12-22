import express from 'express';
import { prisma } from './prisma/client';
import { authRequired, AuthedRequest } from './auth/middleware';
import { isMentor, isViewer } from './auth/roles';
import crypto from 'crypto';

const router = express.Router();

// Save or update mentor form (mentor only)
router.post('/', authRequired, async (req: AuthedRequest, res) => {
  try {
    const user = req.user!;
    if (!isMentor(user.role)) return res.status(403).json({ ok: false, error: 'Only mentors may submit form' });
    
    const payload = req.body || {};
    const jsonString = JSON.stringify(payload);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    // Upsert using raw SQL because Prisma Client generation is locked
    await prisma.$executeRawUnsafe(`
      INSERT INTO "MentorForm" (id, mentorId, data, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(mentorId) DO UPDATE SET data=excluded.data, updatedAt=excluded.updatedAt
    `, id, user.id, jsonString, now, now);

    return res.json({ ok: true, data: payload });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Get mentor form (mentor themselves, or their assigned students)
router.get('/:mentorId', authRequired, async (req: AuthedRequest, res) => {
  try {
    const user = req.user!;
    const { mentorId } = req.params;
    
    let allow = false;
    if (user.id === mentorId) allow = true;
    else if (user.role === 'admin') allow = true;
    else if (isViewer(user.role)) {
      // Check if this student is assigned to this mentor
      const student = await prisma.student.findUnique({ where: { id: user.id } });
      if (student && student.mentorId === mentorId) {
        allow = true;
      }
    }

    if (!allow) return res.status(403).json({ ok: false, error: 'Forbidden' });

    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT data FROM "MentorForm" WHERE mentorId = ? LIMIT 1`, mentorId);
    if (!rows || rows.length === 0) return res.status(404).json({ ok: false, error: 'Not found' });
    
    return res.json({ ok: true, data: JSON.parse(rows[0].data) });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
