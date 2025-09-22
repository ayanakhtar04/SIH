import { prisma } from './client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/*
  Seed students from original CSV if available.
  Looks for ../../students_import.csv or ../../students_import.csv relative to backend-node root.
  Falls back to doing nothing if file not found.
*/
async function main() {
  const candidatePaths = [
    path.join(process.cwd(), 'students_import.csv'),
    path.join(process.cwd(), '..', '..', 'students_import.csv'),
    path.join(process.cwd(), '..', 'students_import.csv')
  ];
  const filePath = candidatePaths.find(p => fs.existsSync(p));
  if (!filePath) {
    console.log('No original CSV found to seed.');
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length);
  if (lines.length <= 1) { console.log('CSV empty or header only'); return; }
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const idxCode = header.indexOf('student_code');
  const idxName = header.indexOf('name');
  const idxEmail = header.indexOf('email');
  const idxProgram = header.indexOf('program');
  const idxYear = header.indexOf('year');
  const idxRisk = header.indexOf('risk_score');
  if (idxCode < 0 || idxName < 0 || idxEmail < 0) {
    console.log('Missing required headers student_code,name,email');
    return;
  }
  let created = 0; let skipped = 0;
  for (let i=1;i<lines.length;i++) {
    const parts = lines[i].split(',');
    if (!parts[idxCode] || !parts[idxName] || !parts[idxEmail]) { skipped++; continue; }
    const studentCode = parts[idxCode].trim();
    const name = parts[idxName].trim();
    const email = parts[idxEmail].trim();
    const program = idxProgram >=0 ? parts[idxProgram].trim() || null : null;
    const yearRaw = idxYear >=0 ? parts[idxYear].trim() : '';
    const riskRaw = idxRisk >=0 ? parts[idxRisk].trim() : '';
    const year = yearRaw ? Number(yearRaw) : null;
    const riskScore = riskRaw? Number(riskRaw): null;
    try {
      await prisma.student.create({ data: { id: crypto.randomUUID(), studentCode, name, email, program, year: isNaN(year||NaN)? null : year, riskScore: isNaN(riskScore||NaN)? null : riskScore, lastRiskUpdated: riskScore != null ? new Date() : null } });
      created++;
    } catch (e:any) {
      if (e.code === 'P2002') { skipped++; } else { console.error('Create error', e); }
    }
  }
  console.log(`Seed complete. Created=${created}, Skipped=${skipped}`);
}

main().finally(()=> prisma.$disconnect());
