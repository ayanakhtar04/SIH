import bcrypt from 'bcryptjs';
import { prisma } from './client';
import crypto from 'crypto';

async function main() {
  const adminEmail = 'admin@pathkeepers.local';
  const secondaryAdminEmail = 'admin@admin.com';
  const mentorEmail = 'mentor@pathkeepers.local';
  const mentor2Email = 'mentor2@pathkeepers.local';

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: adminEmail,
        name: 'Platform Admin',
        role: 'admin',
        passwordHash: '$2a$10$nL78xIbSpuCIwNV5rZNUm.7S5yFwq0dEivVHj9L1k.Qo0/REEmMTy'
      }
    });
    console.log('Seeded admin user (email: admin@pathkeepers.local, password: Admin@123)');
  }

  // Secondary requested admin account
  const secondaryAdmin = await prisma.user.findUnique({ where: { email: secondaryAdminEmail } });
  if (!secondaryAdmin) {
    await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: secondaryAdminEmail,
        name: 'Secondary Admin',
        role: 'admin',
        passwordHash: await bcrypt.hash('Admin123', 10)
      }
    });
    console.log('Seeded secondary admin (email: admin@admin.com, password: Admin123)');
  }

  const mentor = await prisma.user.findUnique({ where: { email: mentorEmail } });
  if (!mentor) {
    await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: mentorEmail,
        name: 'Mentor One',
        role: 'mentor',
        passwordHash: await bcrypt.hash('Mentor@123', 10)
      }
    });
    console.log('Seeded mentor user (email: mentor@pathkeepers.local, password: Mentor@123)');
  }
  const mentor2 = await prisma.user.findUnique({ where: { email: mentor2Email } });
  if (!mentor2) {
    await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: mentor2Email,
        name: 'Mentor Two',
        role: 'mentor',
        passwordHash: await bcrypt.hash('Mentor2@123', 10)
      }
    });
    console.log('Seeded mentor user (email: mentor2@pathkeepers.local, password: Mentor2@123)');
  }

  // Seed demo students if none exist
  const existingStudents = await prisma.student.count();
  if (existingStudents === 0) {
    const mentorRecord = await prisma.user.findUnique({ where: { email: mentorEmail } });
    const mentorId = mentorRecord?.id;
    const demo = [
      { studentCode: 'STU1001', name: 'Aditi Rao', email: 'aditi@example.edu', program: 'B.Tech CSE', year: 2, riskScore: 0.75, assign: true },
      { studentCode: 'STU1002', name: 'Rahul Mehta', email: 'rahul@example.edu', program: 'B.Tech ECE', year: 1, riskScore: 0.52, assign: true },
      { studentCode: 'STU1003', name: 'Sana Iqbal', email: 'sana@example.edu', program: 'BBA', year: 3, riskScore: 0.33, assign: false },
      { studentCode: 'STU1004', name: 'Karan Shah', email: 'karan@example.edu', program: 'BCA', year: 2, riskScore: null, assign: false },
      { studentCode: 'STU1005', name: 'Meera Nair', email: 'meera@example.edu', program: 'B.Sc Physics', year: 1, riskScore: 0.89, assign: true }
    ];
    for (const s of demo) {
      await prisma.student.create({
        data: {
          id: crypto.randomUUID(),
            studentCode: s.studentCode,
            name: s.name,
            email: s.email,
            program: s.program,
            year: s.year,
            riskScore: s.riskScore as number | null,
            lastRiskUpdated: s.riskScore != null ? new Date() : null,
            mentorId: s.assign ? mentorId : null
        }
      });
    }
    console.log('Seeded demo students (5).');
  }

  // Seed default intervention playbooks
  const playbookCount = await prisma.interventionPlaybook.count();
  if (playbookCount === 0) {
    const defaults = [
      { key:'attendance_improvement', title:'Attendance Improvement Plan', category:'Attendance', description:'Structured plan to improve attendance with weekly check-ins.', steps:[ 'Identify root causes', 'Set attendance goals', 'Weekly mentor review', 'Parent/guardian notification if no improvement' ] },
      { key:'academic_recovery', title:'Academic Performance Recovery', category:'Academics', description:'Plan to raise assessment scores over the term.', steps:[ 'Diagnostic assessment', 'Targeted study schedule', 'Peer tutoring assignment', 'Progress evaluation every 2 weeks' ] },
      { key:'wellbeing_outreach', title:'Wellbeing Outreach', category:'Wellbeing', description:'Support plan addressing personal or emotional challenges.', steps:[ 'Initial wellbeing interview', 'Counselor referral if needed', 'Resource pack delivery', 'Follow-up after 1 week' ] }
    ];
    for (const p of defaults) {
      await prisma.interventionPlaybook.create({ data: { key: p.key, title: p.title, category: p.category, description: p.description, steps: p.steps } });
    }
    console.log('Seeded default intervention playbooks (3).');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
