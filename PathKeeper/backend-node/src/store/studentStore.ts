import { prisma } from '../prisma/client';
import { deriveRiskTierFor } from '../util/risk';

export interface StudentDTO {
  id: string;
  studentCode: string;
  name: string;
  email: string;
  program?: string | null;
  year?: number | null;
  riskScore?: number | null;
  lastRiskUpdated?: Date | null;
  mentorId?: string | null;
  riskTier: 'high' | 'medium' | 'low' | 'unknown';
  // Academic fields (stored in DB via runtime-added columns; may be undefined if not populated)
  attendancePercent?: number | null;
  cgpa?: number | null;
  assignmentsCompleted?: number | null;
  assignmentsTotal?: number | null;
  mentorAcademicNote?: string | null;
  lastAcademicUpdate?: Date | null;
  subjects?: any[] | null;
}


export async function listStudents(params: {
  page: number;
  pageSize: number;
  search?: string;
  mentorId?: string;
}): Promise<{ data: StudentDTO[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const { page, pageSize, search, mentorId } = params;
  // SQLite in Prisma does not support 'mode: insensitive'. We'll do a basic case-sensitive search at DB layer
  // and fallback to in-memory case-insensitive filter if needed.
  const baseWhere: any = {};
  if (mentorId) baseWhere.mentorId = mentorId;
  const where = search
    ? {
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
      }
    : baseWhere;

  const [total, rows] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  // If search provided, refine results case-insensitively client-side
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

  // Fetch academic columns via raw SQL (Prisma model may not include them yet)
  let extrasById: Record<string, any> = {};
  try {
    const ids = filtered.map(r => r.id);
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const raw: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, attendancePercent, cgpa, assignmentsCompleted, assignmentsTotal, mentorAcademicNote, subjectsJson, lastAcademicUpdate FROM "Student" WHERE id IN (${placeholders})`,
        ...ids
      );
      extrasById = Object.fromEntries(
        raw.map((row: any) => [
          row.id,
          {
            attendancePercent: typeof row.attendancePercent === 'number' ? row.attendancePercent : (row.attendancePercent != null ? Number(row.attendancePercent) : null),
            cgpa: typeof row.cgpa === 'number' ? row.cgpa : (row.cgpa != null ? Number(row.cgpa) : null),
            assignmentsCompleted: row.assignmentsCompleted != null ? Number(row.assignmentsCompleted) : null,
            assignmentsTotal: row.assignmentsTotal != null ? Number(row.assignmentsTotal) : null,
            mentorAcademicNote: row.mentorAcademicNote ?? null,
            lastAcademicUpdate: row.lastAcademicUpdate ? new Date(row.lastAcademicUpdate) : null,
            subjects: (() => { try { return row.subjectsJson ? JSON.parse(row.subjectsJson) : null; } catch { return null; } })()
          }
        ])
      );
    }
  } catch {
    // swallow extras errors; proceed without academic fields
    extrasById = {};
  }

  const data: StudentDTO[] = filtered.map(r => {
    const extra = extrasById[r.id] || {};
    return {
      id: r.id,
      studentCode: r.studentCode,
      name: r.name,
      email: r.email,
      program: r.program,
      year: r.year,
      riskScore: r.riskScore,
      lastRiskUpdated: r.lastRiskUpdated,
      mentorId: r.mentorId,
      riskTier: deriveRiskTierFor(r.riskScore),
      attendancePercent: extra.attendancePercent ?? null,
      cgpa: extra.cgpa ?? null,
      assignmentsCompleted: extra.assignmentsCompleted ?? null,
      assignmentsTotal: extra.assignmentsTotal ?? null,
      mentorAcademicNote: extra.mentorAcademicNote ?? null,
      lastAcademicUpdate: extra.lastAcademicUpdate ?? null,
      subjects: extra.subjects ?? null
    } as StudentDTO;
  });

  return {
    data,
    total: search ? filtered.length : total,
    page,
    pageSize,
    totalPages: Math.ceil((search ? filtered.length : total) / pageSize) || 1
  };
}
