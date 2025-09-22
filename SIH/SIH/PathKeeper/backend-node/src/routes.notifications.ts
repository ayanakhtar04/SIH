import { Router } from 'express';
import { authRequired, AuthedRequest } from './auth/middleware';
import { isAdmin, isCounselor, isMentor } from './auth/roles';
import { prisma } from './prisma/client';

// Simple provider abstraction placeholder
interface SendParams { channel: 'email'|'sms'; to: string; subject?: string; body: string; }
async function sendOutbound(params: SendParams): Promise<{ id: string; status: string; }> {
  // In real implementation, integrate with SMTP/SMS provider.
  // For now, we simulate success immediately.
  return { id: 'prov_' + Math.random().toString(36).slice(2), status: 'sent' };
}

const notificationsRouter = Router();

// POST /api/notify  { channel, studentIds?, recipients?, subject?, body }
notificationsRouter.post('/notify', authRequired, async (req: AuthedRequest, res) => {
  if (!(isAdmin(req.user?.role) || isCounselor(req.user?.role) || isMentor(req.user?.role))) {
    return res.status(403).json({ ok:false, error:'Forbidden' });
  }
  const { channel = 'email', studentIds, recipients, subject, body } = req.body || {};
  if (!body || typeof body !== 'string') {
    return res.status(400).json({ ok:false, error:'Missing body' });
  }
  if (!['email','sms'].includes(channel)) {
    return res.status(400).json({ ok:false, error:'Unsupported channel' });
  }
  let targetRecipients: { studentId?: string; address: string; }[] = [];
  try {
    if (Array.isArray(studentIds) && studentIds.length) {
      const students = await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id:true, email:true } });
      targetRecipients.push(...students.filter(s=> !!s.email).map(s=> ({ studentId: s.id, address: s.email! })));
    }
    if (Array.isArray(recipients) && recipients.length) {
      targetRecipients.push(...recipients.filter((r: any)=> typeof r === 'string').map((address: string)=> ({ address })));
    }
    // de-dupe by address
    const seen = new Set<string>();
    targetRecipients = targetRecipients.filter(r=> { if (seen.has(r.address)) return false; seen.add(r.address); return true; });
    if (!targetRecipients.length) {
      return res.status(400).json({ ok:false, error:'No valid recipients resolved' });
    }
    const createdLogs: any[] = [];
    for (const rec of targetRecipients) {
      const sendResult = await sendOutbound({ channel, to: rec.address, subject, body });
      const log = await prisma.notificationLog.create({ data: {
        channel,
        status: sendResult.status,
        recipient: rec.address,
        subject: subject || null,
        body,
        studentId: rec.studentId || null,
        createdById: req.user?.id || null
      }});
      createdLogs.push({ id: log.id, channel: log.channel, status: log.status, recipient: log.recipient, studentId: log.studentId });
    }
    return res.json({ ok:true, count: createdLogs.length, notifications: createdLogs });
  } catch (e) {
    return res.status(500).json({ ok:false, error:'Failed to send notifications' });
  }
});

// GET /api/notifications/logs?limit=50
notificationsRouter.get('/notifications/logs', authRequired, async (req: AuthedRequest, res) => {
  if (!(isAdmin(req.user?.role) || isCounselor(req.user?.role))) {
    return res.status(403).json({ ok:false, error:'Forbidden' });
  }
  const limit = Math.min(parseInt(String(req.query.limit||'50'),10)||50, 200);
  try {
    const logs = await prisma.notificationLog.findMany({ orderBy: { createdAt:'desc' }, take: limit });
    return res.json({ ok:true, logs });
  } catch (e) {
    return res.status(500).json({ ok:false, error:'Failed to list logs' });
  }
});

// POST /api/assist/draft { contextType, studentId?, tone? }
notificationsRouter.post('/assist/draft', authRequired, async (req: AuthedRequest, res) => {
  if (!(isAdmin(req.user?.role) || isCounselor(req.user?.role) || isMentor(req.user?.role))) {
    return res.status(403).json({ ok:false, error:'Forbidden' });
  }
  const { contextType = 'general', studentId, tone = 'supportive' } = req.body || {};
  try {
    let studentFragment = '';
    if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name:true, riskScore:true, program:true } });
      if (student) {
        const riskStr = student.riskScore != null ? `current risk score ${(student.riskScore*100).toFixed(0)}%.` : 'risk score not yet available.';
        studentFragment = ` regarding student ${student.name} (${student.program||'Program N/A'}), ${riskStr}`;
      }
    }
    const body = `Hello${studentFragment}\n\nThis is a ${tone} message generated as a starting point for ${contextType} outreach. Please personalize before sending.\n\nKey points:\n- Acknowledge progress\n- Offer specific support resources\n- Encourage next steps\n\nRegards,\nYour Support Team`;
    return res.json({ ok:true, draft: body });
  } catch (e) {
    return res.status(500).json({ ok:false, error:'Failed to generate draft' });
  }
});

export default notificationsRouter;
