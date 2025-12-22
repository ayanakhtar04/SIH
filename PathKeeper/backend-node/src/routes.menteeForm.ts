import express from 'express';
import path from 'path';
import { prisma } from './prisma/client';
import { authRequired, AuthedRequest } from './auth/middleware';
import { isMentor } from './auth/roles';
import ejs from 'ejs';
import puppeteer from 'puppeteer';

const router = express.Router();

// Save or update mentee form (student only)
router.post('/', authRequired, async (req: AuthedRequest, res) => {
  try {
    const user = req.user!;
    if (!user || user.role !== 'viewer') return res.status(403).json({ ok: false, error: 'Only student accounts may submit form' });
    const payload = req.body || {};
    const jsonString = JSON.stringify(payload);
    const now = new Date().toISOString();
    const id = require('crypto').randomUUID();

    // Upsert using raw SQL because Prisma Client generation is locked
    await prisma.$executeRawUnsafe(`
      INSERT INTO "MenteeForm" (id, studentId, data, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(studentId) DO UPDATE SET data=excluded.data, updatedAt=excluded.updatedAt
    `, id, user.id, jsonString, now, now);

    return res.json({ ok: true, data: payload });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Save or update mentee form (mentor override)
router.post('/:studentId', authRequired, async (req: AuthedRequest, res) => {
  try {
    const user = req.user!;
    const { studentId } = req.params;
    const allow = isMentor(user.role); // Only mentors/admins can update other students' forms
    if (!allow) return res.status(403).json({ ok: false, error: 'forbidden' });

    const payload = req.body || {};
    const jsonString = JSON.stringify(payload);
    const now = new Date().toISOString();
    const id = require('crypto').randomUUID();

    // Upsert
    await prisma.$executeRawUnsafe(`
      INSERT INTO "MenteeForm" (id, studentId, data, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(studentId) DO UPDATE SET data=excluded.data, updatedAt=excluded.updatedAt
    `, id, studentId, jsonString, now, now);

    return res.json({ ok: true, data: payload });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Get mentee form (mentor or owner)
router.get('/:studentId', authRequired, async (req: AuthedRequest, res) => {
  try {
    const user = req.user!;
    const { studentId } = req.params;
    const allow = (user.id === studentId) || isMentor(user.role);
    if (!allow) return res.status(403).json({ ok: false, error: 'forbidden' });
    
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT data FROM "MenteeForm" WHERE studentId = ? LIMIT 1`, studentId);
    if (!rows || rows.length === 0) return res.status(404).json({ ok: false, error: 'not found' });
    
    return res.json({ ok: true, data: JSON.parse(rows[0].data) });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Download PDF (mentor or owner) - generates PDF from EJS template
router.get('/:studentId/pdf', authRequired, async (req: AuthedRequest, res) => {
  try {
    const user = req.user!;
    const { studentId } = req.params;
    const allow = (user.id === studentId) || isMentor(user.role);
    if (!allow) return res.status(403).json({ ok: false, error: 'forbidden' });
    
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT data FROM "MenteeForm" WHERE studentId = ? LIMIT 1`, studentId);
    if (!rows || rows.length === 0) return res.status(404).json({ ok: false, error: 'not found' });
    
    const data = JSON.parse(rows[0].data);
    const tplPath = path.join(process.cwd(), 'src', 'templates', 'menteeForm.ejs');
    const html = await ejs.renderFile(tplPath, { data, studentId }, { async: true });

    // Launch puppeteer and render PDF
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: {
        top: '0.62in',
        left: '0.95in',
        bottom: '0.49in',
        right: '1.03in'
      }
    });
    await browser.close();

    const filename = `${data.enrollment || 'NA'}_${data.course || 'NA'}_${data.semester || 'NA'}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
