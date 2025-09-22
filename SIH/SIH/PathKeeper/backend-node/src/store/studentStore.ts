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

  const data: StudentDTO[] = filtered.map(r => ({
    id: r.id,
    studentCode: r.studentCode,
    name: r.name,
    email: r.email,
    program: r.program,
    year: r.year,
    riskScore: r.riskScore,
    lastRiskUpdated: r.lastRiskUpdated,
    mentorId: r.mentorId,
    riskTier: deriveRiskTierFor(r.riskScore)
  }));

  return {
    data,
    total: search ? filtered.length : total,
    page,
    pageSize,
    totalPages: Math.ceil((search ? filtered.length : total) / pageSize) || 1
  };
}
