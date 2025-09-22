-- Add extended profile columns to Student
ALTER TABLE "Student" ADD COLUMN "phone" TEXT;
ALTER TABLE "Student" ADD COLUMN "guardianName" TEXT;
ALTER TABLE "Student" ADD COLUMN "guardianEmail" TEXT;
ALTER TABLE "Student" ADD COLUMN "guardianPhone" TEXT;
ALTER TABLE "Student" ADD COLUMN "acceptedTermsAt" DATETIME;

-- Create AuditLog table
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "userId" TEXT,
  "details" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create InterventionPlaybook table
CREATE TABLE IF NOT EXISTS "InterventionPlaybook" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "key" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "steps" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create StudentPlaybookAssignment table
CREATE TABLE IF NOT EXISTS "StudentPlaybookAssignment" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studentId" TEXT NOT NULL,
  "playbookId" TEXT NOT NULL,
  "mentorId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'assigned',
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  CONSTRAINT "SPA_student_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SPA_playbook_fkey" FOREIGN KEY ("playbookId") REFERENCES "InterventionPlaybook"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SPA_mentor_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create MentorNote table
CREATE TABLE IF NOT EXISTS "MentorNote" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studentId" TEXT NOT NULL,
  "mentorId" TEXT,
  "note" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MentorNote_student_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MentorNote_mentor_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create Meeting table
CREATE TABLE IF NOT EXISTS "Meeting" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studentId" TEXT NOT NULL,
  "mentorId" TEXT,
  "title" TEXT NOT NULL,
  "startsAt" DATETIME NOT NULL,
  "endsAt" DATETIME NOT NULL,
  "location" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Meeting_student_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Meeting_mentor_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create NotificationLog table
CREATE TABLE IF NOT EXISTS "NotificationLog" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "studentId" TEXT,
  "createdById" TEXT,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_student_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "NotificationLog_createdBy_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create RiskModelConfig table
CREATE TABLE IF NOT EXISTS "RiskModelConfig" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "weights" TEXT NOT NULL,
  "thresholds" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME
);

-- Indices for performance / uniqueness
CREATE INDEX IF NOT EXISTS "NotificationLog_student_idx" ON "NotificationLog" ("studentId");
CREATE INDEX IF NOT EXISTS "RiskModelConfig_active_idx" ON "RiskModelConfig" ("active");
