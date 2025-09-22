import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { authRequired, AuthedRequest } from './auth/middleware';
import { listStudents } from './store/studentStore';
import { isCounselor, isAdmin, isMentor } from './auth/roles';
import multer from 'multer';
import { parseAndValidateCSV } from './util/csvImport';
import { prisma } from './prisma/client';
import { deriveRiskTierFor } from './util/risk';
import crypto from 'crypto';

// Runtime column ensure (for environments where migration failed) – SQLite only
async function ensureAcademicColumns() {
  try {
    const cols = await prisma.$queryRawUnsafe<any[]>("PRAGMA table_info('Student')");
    const have = new Set(cols.map(c=> c.name));
    const statements: string[] = [];
    if (!have.has('attendancePercent')) statements.push("ALTER TABLE 'Student' ADD COLUMN 'attendancePercent' REAL");
    if (!have.has('cgpa')) statements.push("ALTER TABLE 'Student' ADD COLUMN 'cgpa' REAL");
    if (!have.has('subjectsJson')) statements.push("ALTER TABLE 'Student' ADD COLUMN 'subjectsJson' TEXT");
    if (!have.has('assignmentsCompleted')) statements.push("ALTER TABLE 'Student' ADD COLUMN 'assignmentsCompleted' INTEGER");
    if (!have.has('assignmentsTotal')) statements.push("ALTER TABLE 'Student' ADD COLUMN 'assignmentsTotal' INTEGER");
    if (!have.has('mentorAcademicNote')) statements.push("ALTER TABLE 'Student' ADD COLUMN 'mentorAcademicNote' TEXT");
    if (!have.has('lastAcademicUpdate')) statements.push("ALTER TABLE 'Student' ADD COLUMN 'lastAcademicUpdate' DATETIME");
    for (const sql of statements) {
      try { await prisma.$executeRawUnsafe(sql); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

async function ensureRiskSnapshotTable() {
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RiskSnapshot" (
      id TEXT PRIMARY KEY NOT NULL,
      studentId TEXT NOT NULL,
      riskScore REAL NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source TEXT,
      FOREIGN KEY(studentId) REFERENCES Student(id) ON DELETE CASCADE
    )`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS RiskSnapshot_student_idx ON "RiskSnapshot" (studentId, createdAt)`);
  } catch { /* ignore */ }
}

const studentsRouter = Router();

// Rate limiter specifically for import endpoint (protect heavy bulk operations)
const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // up to 10 import attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many import attempts, please try later', status: 429 }
});

// GET /api/students?page=1&pageSize=20&search=term
studentsRouter.get('/', authRequired, async (req: AuthedRequest, res) => {
  // Access control: admins see all, counselors & mentors are scoped to their own assigned students unless includeUnassigned flag is set.
  if (!(isAdmin(req.user?.role) || isCounselor(req.user?.role) || isMentor(req.user?.role))) {
    return res.status(403).json({ ok: false, error: 'Forbidden', status: 403 });
  }
  const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
  const pageSizeRaw = parseInt(String(req.query.pageSize || '20'), 10) || 20;
  const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
  const search = req.query.search ? String(req.query.search) : undefined;
  const includeUnassigned = String(req.query.includeUnassigned || '0') === '1';
  const scoped = (isMentor(req.user?.role) || isCounselor(req.user?.role));
  const mentorId = scoped ? req.user?.id : undefined;

  try {
    if (scoped && includeUnassigned) {
      const result = await listStudents({ page, pageSize, search }); // unfiltered result has shape { data, total, ... }
      const filtered = result.data.filter((s: any) => !s.mentorId || s.mentorId === mentorId);
      return res.json({ ok: true, data: filtered, total: filtered.length, page, pageSize, totalPages: Math.ceil(filtered.length / pageSize) });
    }
    const result = await listStudents({ page, pageSize, search, mentorId });
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to list students', status: 500 });
  }
});

// GET /api/students/export.csv?search=term
// Admin: all students. Mentor: only their assigned students. (Counselor currently treated like admin for consistency with list endpoint.)
studentsRouter.get('/export.csv', authRequired, async (req: AuthedRequest, res) => {
  if (!(isAdmin(req.user?.role) || isMentor(req.user?.role) || isCounselor(req.user?.role))) {
    return res.status(403).json({ ok: false, error: 'Forbidden', status: 403 });
  }
  const search = req.query.search ? String(req.query.search) : undefined;
  const mentorId = isMentor(req.user?.role) ? req.user?.id : undefined;
  try {
    // Build where clause similar to listStudents (without pagination)
    const baseWhere: any = {};
    if (mentorId) baseWhere.mentorId = mentorId;
    let where: any = baseWhere;
    if (search) {
      where = {
        AND: [
          baseWhere,
          {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { studentCode: { contains: search } }
            ]
          }
        ]
      };
    }
    const rows = await prisma.student.findMany({ where, orderBy: { createdAt: 'asc' } });
    // Case-insensitive refine like listStudents
    const filtered = search
      ? rows.filter(r => {
          const needle = search.toLowerCase();
          return (
            r.name.toLowerCase().includes(needle) ||
            r.email.toLowerCase().includes(needle) ||
            r.studentCode.toLowerCase().includes(needle)
          );
        })
      : rows;

    // CSV serialization
    function esc(value: any): string {
      if (value == null) return '';
      const str = String(value);
      if (/[",\n]/.test(str)) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    const header = [
      'id',
      'studentCode',
      'name',
      'email',
      'program',
      'year',
      'riskScore',
      'riskTier',
      'lastRiskUpdated',
      'mentorId',
      'createdAt'
    ];
    const lines: string[] = [header.join(',')];
    for (const r of filtered) {
      lines.push([
        esc(r.id),
        esc(r.studentCode),
        esc(r.name),
        esc(r.email),
        esc(r.program ?? ''),
        esc(r.year ?? ''),
        esc(r.riskScore != null ? r.riskScore : ''),
        esc(deriveRiskTierFor(r.riskScore)),
        esc(r.lastRiskUpdated ? r.lastRiskUpdated.toISOString() : ''),
        esc(r.mentorId ?? ''),
        esc(r.createdAt.toISOString())
      ].join(','));
    }
    const csv = lines.join('\n');
    const ts = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const filename = `students_export_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to export CSV', status: 500 });
  }
});

export default studentsRouter;

// PATCH /api/students/:id  (mentor can update academic indicators of their assigned students; admins can update any)
studentsRouter.patch('/:id', authRequired, async (req: AuthedRequest, res) => {
  await ensureAcademicColumns();
  await ensureRiskSnapshotTable();
  if (!(isAdmin(req.user?.role) || isMentor(req.user?.role))) {
    return res.status(403).json({ ok:false, error:'Forbidden' });
  }
  const { id } = req.params;
  const body = req.body || {};
  const allowed = ['attendancePercent','cgpa','subjects','assignmentsCompleted','assignmentsTotal','mentorAcademicNote'];
  const update: any = {};
  for (const k of allowed) if (k in body) update[k] = body[k];
  if (Object.keys(update).length === 0) return res.status(400).json({ ok:false, error:'No editable fields provided' });
  try {
    const student = await prisma.student.findUnique({ where:{ id } });
    if (!student) return res.status(404).json({ ok:false, error:'Not found' });
    // Relaxed: mentors can edit if student is unassigned OR assigned to them. Still blocked if owned by someone else.
    if (isMentor(req.user?.role) && student.mentorId && student.mentorId !== req.user?.id) {
      return res.status(403).json({ ok:false, error:'Forbidden' });
    }
    // Normalize inputs
    const attendance = typeof update.attendancePercent === 'number'
      ? Math.min(100, Math.max(0, update.attendancePercent))
      : (student as any).attendancePercent;
    const cgpa = typeof update.cgpa === 'number'
      ? Math.min(10, Math.max(0, update.cgpa))
      : (student as any).cgpa;
    const assignmentsCompleted = Number.isInteger(update.assignmentsCompleted)
      ? Math.max(0, update.assignmentsCompleted)
      : (student as any).assignmentsCompleted;
    const assignmentsTotal = Number.isInteger(update.assignmentsTotal)
      ? Math.max(0, update.assignmentsTotal)
      : (student as any).assignmentsTotal;
    const subjectsArr = Array.isArray(update.subjects) ? update.subjects.slice(0,50) : undefined; // limit size
    const note = typeof update.mentorAcademicNote === 'string' ? update.mentorAcademicNote.slice(0,5000) : undefined;

    // Compute new risk if any academic indicator changed
    const currentAttendance = (student as any).attendancePercent ?? 0;
    const currentCgpa = (student as any).cgpa ?? 0;
    const currentAC = (student as any).assignmentsCompleted ?? 0;
    const currentAT = (student as any).assignmentsTotal ?? 0;
    const changed = (typeof attendance === 'number' && attendance !== (student as any).attendancePercent)
      || (typeof cgpa === 'number' && cgpa !== (student as any).cgpa)
      || (typeof assignmentsCompleted === 'number' && assignmentsCompleted !== currentAC)
      || (typeof assignmentsTotal === 'number' && assignmentsTotal !== currentAT)
      || !!subjectsArr || note !== undefined;

  const cgpaScale = Number(process.env.CGPA_SCALE) === 5 ? 5 : 10; // default scale 10 unless explicitly set to 5
  let riskScore = student.riskScore ?? 0.5;
    if (changed) {
      const attComponent = (typeof attendance === 'number') ? (1 - attendance/100) : (1 - currentAttendance/100);
  const cgpaComponent = (typeof cgpa === 'number') ? (1 - cgpa/ cgpaScale) : (1 - currentCgpa/ cgpaScale);
      const comp = (typeof assignmentsCompleted === 'number') ? assignmentsCompleted : currentAC;
      const tot = (typeof assignmentsTotal === 'number') ? assignmentsTotal : currentAT;
      const assignComponent = 1 - (tot>0 ? comp/Math.max(1,tot) : 0);
      let notePenalty = 0;
      const text = note ?? (student as any).mentorAcademicNote ?? '';
      if (/fail|risk|struggl|drop|absent/i.test(text)) notePenalty = 0.1;
      riskScore = Math.max(0, Math.min(1, (attComponent*0.35 + cgpaComponent*0.35 + assignComponent*0.2 + notePenalty)));
    }
    const tier = deriveRiskTierFor(riskScore);

    // Build update SQL fallback (since Prisma client lacks new fields until schema regen). We attempt dynamic column presence.
    const cols: string[] = []; const params: any[] = [];
    function push(col: string, val: any) { cols.push(`${col} = ?`); params.push(val); }
  if (typeof update.attendancePercent === 'number') push('attendancePercent', attendance);
  if (typeof update.cgpa === 'number') push('cgpa', cgpa);
  if (subjectsArr) push('subjectsJson', JSON.stringify(subjectsArr));
  if (Number.isInteger(update.assignmentsCompleted)) push('assignmentsCompleted', assignmentsCompleted);
  if (Number.isInteger(update.assignmentsTotal)) push('assignmentsTotal', assignmentsTotal);
  if (note !== undefined) push('mentorAcademicNote', note);
    if (changed) { push('riskScore', riskScore); push('lastRiskUpdated', new Date().toISOString()); }
    push('lastAcademicUpdate', new Date().toISOString());
    if (cols.length === 0) return res.json({ ok:true, student: { id: student.id, riskScore, riskTier: tier } });
    params.push(id);
    await prisma.$executeRawUnsafe(`UPDATE "Student" SET ${cols.join(', ')} WHERE id = ?`, ...params);
    if (changed) {
      try {
        await prisma.$executeRawUnsafe(`INSERT INTO "RiskSnapshot" (id, studentId, riskScore, source) VALUES (?, ?, ?, ?)`, crypto.randomUUID(), id, riskScore, 'academic_update');
      } catch { /* ignore snapshot errors */ }
    }
    return res.json({ ok:true, student:{ id: student.id, riskScore, riskTier: tier, attendancePercent: attendance, cgpa, assignmentsCompleted, assignmentsTotal } });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:'Update failed', detail: e.message });
  }
});

// Detail endpoint placed after export to keep list first (Express order doesn't matter for different paths)
studentsRouter.get('/:id', authRequired, async (req: AuthedRequest, res) => {
  if (!(isAdmin(req.user?.role) || isCounselor(req.user?.role) || isMentor(req.user?.role))) {
    return res.status(403).json({ ok: false, error: 'Forbidden', status: 403 });
  }
  const { id } = req.params;
  try {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      return res.status(404).json({ ok: false, error: 'Student not found', status: 404 });
    }
    if (isCounselor(req.user?.role) && student.mentorId !== req.user?.id) {
      return res.status(403).json({ ok: false, error: 'Forbidden', status: 403 });
    }
    const payload = {
      id: student.id,
      studentCode: student.studentCode,
      name: student.name,
      email: student.email,
      program: student.program,
      year: student.year,
      riskScore: student.riskScore,
      riskTier: deriveRiskTierFor(student.riskScore),
      lastRiskUpdated: student.lastRiskUpdated,
      mentorId: student.mentorId,
      createdAt: student.createdAt
    };
    return res.json({ ok: true, student: payload });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to fetch student', status: 500 });
  }
});

// Multer memory storage for CSV
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 } });

// POST /api/students/import  (multipart form-data: file=students.csv, optional field dryRun=true)
studentsRouter.post('/import', authRequired, importLimiter, upload.single('file'), async (req: AuthedRequest, res) => {
  if (!isAdmin(req.user?.role)) {
    return res.status(403).json({ ok: false, error: 'Forbidden', status: 403 });
  }
  await ensureAcademicColumns();
  await ensureRiskSnapshotTable();

  // Determine CSV source: multipart file OR raw text/csv body
  let csvContent: string | undefined;
  if (req.file) {
    csvContent = req.file.buffer.toString('utf8');
  } else if (req.is('text/csv') && typeof req.body === 'string') {
    csvContent = req.body;
  }
  if (!csvContent) {
    return res.status(400).json({ ok: false, error: 'Missing file or text/csv body', status: 400 });
  }

  // dryRun can come from query (?dryRun=false) or form field/body
  const dryRunParam = (req.query.dryRun ?? (typeof req.body === 'object' ? (req.body as any)?.dryRun : undefined));
  const dryRun = String(dryRunParam != null ? dryRunParam : (req.file ? req.body?.dryRun : 'true')).toLowerCase() === 'true';
  // Gather existing codes/emails for duplicate detection
  const existingStudents = await prisma.student.findMany({ select: { studentCode: true, email: true } });
  const existingCodes = new Set(existingStudents.map(s => s.studentCode));
  const existingEmails = new Set(existingStudents.map(s => s.email.toLowerCase()));
  const parsed = parseAndValidateCSV(csvContent, { existingCodes, existingEmails });
  parsed.dryRun = dryRun;
  if (parsed.errors.length) {
    return res.status(200).json(parsed); // Return validation feedback even if errors
  }
  if (dryRun) {
    // If riskScore missing but academic metrics present, simulate inferred risk for preview
    await maybeAttachInferredRisk(parsed.rows);
    return res.json(parsed);
  }
  let created = 0;
  try {
    await prisma.$transaction(async (tx) => {
      await maybeAttachInferredRisk(parsed.rows, tx);
      for (const row of parsed.rows) {
        const createdStudent = await tx.student.create({
          data: {
            studentCode: row.studentCode,
            name: row.name,
            email: row.email,
            program: row.program,
            year: row.year ?? null,
            riskScore: row.riskScore ?? null,
            lastRiskUpdated: row.riskScore != null ? new Date() : null
          }
        });
        created++;
        // Persist academic columns via raw update (Prisma schema not yet extended) if any provided
        const cols: string[] = []; const params: any[] = [];
        function push(col: string, val: any) { cols.push(`${col} = ?`); params.push(val); }
        if (typeof row.attendancePercent === 'number') push('attendancePercent', row.attendancePercent);
        if (typeof row.cgpa === 'number') push('cgpa', row.cgpa);
        if (typeof row.assignmentsCompleted === 'number') push('assignmentsCompleted', row.assignmentsCompleted);
        if (typeof row.assignmentsTotal === 'number') push('assignmentsTotal', row.assignmentsTotal);
        if (row.subjects && row.subjects.length) push('subjectsJson', JSON.stringify(row.subjects));
        if (typeof row.mentorAcademicNote === 'string' && row.mentorAcademicNote.length) push('mentorAcademicNote', row.mentorAcademicNote);
        if (cols.length) {
          push('lastAcademicUpdate', new Date().toISOString());
          if (row.riskScore != null) { push('lastRiskUpdated', new Date().toISOString()); }
          params.push(createdStudent.id);
          try { await tx.$executeRawUnsafe(`UPDATE "Student" SET ${cols.join(', ')} WHERE id = ?`, ...params); } catch { /* ignore */ }
        }
        if (row.riskScore != null) {
          try { await tx.$executeRawUnsafe(`INSERT INTO "RiskSnapshot" (id, studentId, riskScore, source) VALUES (?, ?, ?, ?)`, crypto.randomUUID(), createdStudent.id, row.riskScore, 'import'); } catch { /* ignore */ }
        }
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Import failed (rolled back)', status: 500 });
  }
  return res.json({
    ok: true,
    dryRun: false,
    counts: { ...parsed.counts, created, skipped: parsed.counts.total - created },
    errors: [],
    rows: parsed.rows
  });
});

// Helper: infer riskScore for rows missing it using active RiskModelConfig weights
async function maybeAttachInferredRisk(rows: any[], tx?: any) {
  // Load active config (raw SQL fallback) else use defaults
  const client: any = tx || prisma;
  let weights = { attendance: 0.35, gpa: 0.35, assignments: 0.2, notes: 0.1 };
  try {
    await client.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RiskModelConfig" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "weights" TEXT NOT NULL,
      "thresholds" TEXT NOT NULL,
      "active" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME
    )`);
  const rowsCfg = await client.$queryRawUnsafe("SELECT * FROM 'RiskModelConfig' WHERE active = 1 ORDER BY createdAt DESC LIMIT 1");
    if (rowsCfg.length) {
      try {
        const parsed = JSON.parse(rowsCfg[0].weights);
        if (parsed && typeof parsed === 'object') {
          weights = { ...weights, ...parsed };
        }
      } catch { /* ignore parse */ }
    }
  } catch { /* ignore */ }
  const totalW = weights.attendance + weights.gpa + weights.assignments + weights.notes;
  function safeDiv(n: number, d: number) { return d === 0 ? 0 : n/d; }
  const cgpaScale = Number(process.env.CGPA_SCALE) === 5 ? 5 : 10;
  for (const r of rows) {
    if (r.riskScore == null) {
      // Build components as risk contributions (higher => higher risk)
      const attComp = (typeof r.attendancePercent === 'number') ? (1 - (r.attendancePercent/100)) : 0.5; // unknown -> neutral 0.5
  const gpaComp = (typeof r.cgpa === 'number') ? (1 - (r.cgpa/ cgpaScale)) : 0.5;
      let assignComp = 0.5;
      if (typeof r.assignmentsCompleted === 'number' && typeof r.assignmentsTotal === 'number' && r.assignmentsTotal > 0) {
        assignComp = 1 - safeDiv(r.assignmentsCompleted, Math.max(1, r.assignmentsTotal));
      }
      let notePenalty = 0;
      if (typeof r.mentorAcademicNote === 'string' && /fail|risk|struggl|drop|absent/i.test(r.mentorAcademicNote)) notePenalty = 1; // full weight usage
      const weighted = (attComp * weights.attendance) + (gpaComp * weights.gpa) + (assignComp * weights.assignments) + (notePenalty * weights.notes);
      const score = Math.max(0, Math.min(1, weighted / (totalW || 1)));
      r.riskScore = score;
    }
  }
}

// GET /api/students/import/template  (returns sample CSV and metadata)
studentsRouter.get('/import/template', authRequired, async (req: AuthedRequest, res) => {
  if (!isAdmin(req.user?.role)) {
    return res.status(403).json({ ok: false, error: 'Forbidden', status: 403 });
  }
  const sampleCsv = [
    'studentCode,name,email,program,year,riskScore',
    'S1001,Jane Doe,jane.doe@example.edu,B.Tech CSE,1,0.42',
    'S1002,John Smith,john.smith@example.edu,BBA,2,0.15'
  ].join('\n');
  return res.json({
    ok: true,
    filenameSuggestion: 'students_import_template.csv',
    sampleCsv,
    columns: [
      { name: 'studentCode', required: true, notes: 'Unique identifier (string)' },
      { name: 'name', required: true },
      { name: 'email', required: true },
      { name: 'program', required: false },
      { name: 'year', required: false, notes: 'Integer 0-12' },
      { name: 'riskScore', required: false, notes: '0-1 decimal, optional initial risk' }
    ],
    dryRunDefault: true,
    rateLimit: { windowMinutes: 15, maxImportsPerWindow: 10 },
    transaction: true
  });
});

// GET /api/students/:id/360  (aggregated profile: student, assignments, notes, meetings, simple trend)
studentsRouter.get('/:id/360', authRequired, async (req: AuthedRequest, res) => {
  if (!(isAdmin(req.user?.role) || isCounselor(req.user?.role) || isMentor(req.user?.role))) {
    return res.status(403).json({ ok: false, error: 'Forbidden', status: 403 });
  }
  const { id } = req.params;
  try {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ ok:false, error:'Not found' });
    // Basic risk trend synthetic (will be replaced by historical table later)
    const baseScore = student.riskScore ?? 0.4;
    const trend = Array.from({ length: 8 }).map((_,i)=> ({
      idx: i,
      score: Math.max(0, Math.min(1, baseScore + Math.sin((i+1)*0.8)*0.08 - i*0.01))
    }));
    let assignments: any[] = [];
    try {
      assignments = await prisma.$queryRawUnsafe<any[]>("SELECT status, createdAt, completedAt, notes, playbookId FROM 'StudentPlaybookAssignment' WHERE studentId = ? ORDER BY datetime(createdAt) DESC", id);
    } catch {}
    let notes: any[] = [];
    try { notes = await prisma.$queryRawUnsafe<any[]>("SELECT note, createdAt, mentorId FROM 'MentorNote' WHERE studentId = ? ORDER BY datetime(createdAt) DESC", id); } catch {}
    let meetings: any[] = [];
    try { meetings = await prisma.$queryRawUnsafe<any[]>("SELECT title, startsAt, endsAt, status FROM 'Meeting' WHERE studentId = ? ORDER BY datetime(startsAt) DESC LIMIT 20", id); } catch {}
    return res.json({ ok:true, student: {
      id: student.id,
      studentCode: student.studentCode,
      name: student.name,
      email: student.email,
      program: student.program,
      year: student.year,
      riskScore: student.riskScore,
      riskTier: deriveRiskTierFor(student.riskScore),
      lastRiskUpdated: student.lastRiskUpdated
    },
    academics: {
      attendancePercent: (student as any).attendancePercent ?? null,
      cgpa: (student as any).cgpa ?? null,
      assignmentsCompleted: (student as any).assignmentsCompleted ?? null,
      assignmentsTotal: (student as any).assignmentsTotal ?? null,
      subjects: (()=>{ try { return JSON.parse((student as any).subjectsJson||'[]'); } catch { return []; } })(),
      mentorAcademicNote: (student as any).mentorAcademicNote ?? null,
      lastAcademicUpdate: (student as any).lastAcademicUpdate ?? null
    },
    trend, assignments, notes, meetings });
  } catch (e) {
    return res.status(500).json({ ok:false, error:'Failed to build profile' });
  }
});

// POST /api/students/:id/claim  (mentor claims an unassigned student)
studentsRouter.post('/:id/claim', authRequired, async (req: AuthedRequest, res) => {
  if (!isMentor(req.user?.role) && !isAdmin(req.user?.role)) {
    return res.status(403).json({ ok:false, error:'Forbidden' });
  }
  const { id } = req.params;
  try {
    const student = await prisma.student.findUnique({ where:{ id } });
    if (!student) return res.status(404).json({ ok:false, error:'Not found' });
    if (student.mentorId && student.mentorId !== req.user?.id && !isAdmin(req.user?.role)) {
      return res.status(409).json({ ok:false, error:'Already assigned' });
    }
    if (student.mentorId === req.user?.id) {
      return res.json({ ok:true, student:{ id: student.id, mentorId: student.mentorId } });
    }
    await prisma.student.update({ where:{ id }, data:{ mentorId: req.user?.id } });
    return res.json({ ok:true, student:{ id, mentorId: req.user?.id } });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:'Claim failed', detail: e.message });
  }
});

// POST /api/students/risk-snapshots/capture (admin only) - captures a snapshot for all students' current risk scores
studentsRouter.post('/risk-snapshots/capture', authRequired, async (req: AuthedRequest, res) => {
  if (!isAdmin(req.user?.role)) return res.status(403).json({ ok:false, error:'Forbidden' });
  await ensureRiskSnapshotTable();
  try {
    const students = await prisma.student.findMany({ select:{ id:true, riskScore:true } });
    const now = new Date();
    let inserted = 0;
    for (const s of students) {
      if (s.riskScore == null) continue;
      try {
        await prisma.$executeRawUnsafe(`INSERT INTO "RiskSnapshot" (id, studentId, riskScore, createdAt, source) VALUES (?, ?, ?, ?, ?)`, crypto.randomUUID(), s.id, s.riskScore, now.toISOString(), 'manual_capture');
        inserted++;
      } catch {/* ignore per-row errors */}
    }
    return res.json({ ok:true, inserted, at: now.toISOString() });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:'Capture failed', detail:e.message });
  }
});

// GET /api/students/risk-trend?days=30 - aggregated daily counts from snapshots (fallback synth if none)
studentsRouter.get('/risk-trend', authRequired, async (req: AuthedRequest, res) => {
  if (!(isAdmin(req.user?.role) || isMentor(req.user?.role) || isCounselor(req.user?.role))) {
    return res.status(403).json({ ok:false, error:'Forbidden' });
  }
  await ensureRiskSnapshotTable();
  const days = Math.min(120, Math.max(7, parseInt(String(req.query.days||'30'),10) || 30));
  const since = new Date(Date.now() - days*24*3600*1000);
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>("SELECT studentId, riskScore, createdAt FROM 'RiskSnapshot' WHERE datetime(createdAt) >= datetime(?) ORDER BY datetime(createdAt) ASC", since.toISOString());
    const byDay: Record<string,{ scores:number[] } & { high:number; medium:number; low:number }> = {} as any;
    for (const r of rows) {
      const d = (new Date(r.createdAt)).toISOString().split('T')[0];
      if (!byDay[d]) byDay[d] = { scores:[], high:0, medium:0, low:0 };
      const score = typeof r.riskScore === 'number'? r.riskScore : Number(r.riskScore);
      if (!isNaN(score)) {
        byDay[d].scores.push(score);
        const tier = deriveRiskTierFor(score);
        if (tier==='high') byDay[d].high++; else if (tier==='medium') byDay[d].medium++; else if (tier==='low') byDay[d].low++;
      }
    }
    // If no snapshots, synthesize from current distribution (graceful fallback)
    if (!Object.keys(byDay).length) {
      const students = await prisma.student.findMany({ select:{ riskScore:true } });
      const today = new Date();
      for (let i=days-1; i>=0; i--) {
        const d = new Date(today.getTime() - i*24*3600*1000).toISOString().split('T')[0];
        let high=0, medium=0, low=0; const scores:number[]=[];
        for (const s of students) {
          const base = s.riskScore ?? 0.45;
          const pseudo = Math.max(0, Math.min(1, base + Math.sin((i+1)*0.35 + base*2) * 0.07 - i*0.0005));
          scores.push(pseudo);
          const tier = deriveRiskTierFor(pseudo);
          if (tier==='high') high++; else if (tier==='medium') medium++; else if (tier==='low') low++;
        }
        byDay[d] = { scores, high, medium, low } as any;
      }
    }
    const trend = Object.keys(byDay).sort().map(date => {
      const entry = byDay[date];
      const avgRisk = entry.scores.length? entry.scores.reduce((a,b)=> a+b,0)/entry.scores.length : null;
      return { date, avgRisk, highCount: entry.high, mediumCount: entry.medium, lowCount: entry.low };
    });
    return res.json({ ok:true, trend });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:'Trend build failed', detail:e.message });
  }
});

// PATCH /api/students/:id/assign-mentor  { mentorId: string|null }
studentsRouter.patch('/:id/assign-mentor', authRequired, async (req: AuthedRequest, res) => {
  if (!isAdmin(req.user?.role)) return res.status(403).json({ ok:false, error:'Forbidden' });
  const { id } = req.params; const { mentorId } = req.body || {};
  try {
    const student = await prisma.student.findUnique({ where:{ id } });
    if (!student) return res.status(404).json({ ok:false, error:'Not found' });
    // Accept null to unassign
    await prisma.student.update({ where:{ id }, data:{ mentorId: mentorId || null } });
    return res.json({ ok:true, student:{ id, mentorId: mentorId || null } });
  } catch(e:any) {
    return res.status(500).json({ ok:false, error:'Mentor assign failed', detail:e.message });
  }
});