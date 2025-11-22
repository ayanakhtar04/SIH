-- Academic indicators for mentors to edit
ALTER TABLE "Student" ADD COLUMN "attendancePercent" REAL; -- 0-100
ALTER TABLE "Student" ADD COLUMN "cgpa" REAL; -- 0-10 scale
ALTER TABLE "Student" ADD COLUMN "subjectsJson" TEXT; -- JSON encoded array [{name, score?}]
ALTER TABLE "Student" ADD COLUMN "assignmentsCompleted" INTEGER;
ALTER TABLE "Student" ADD COLUMN "assignmentsTotal" INTEGER;
ALTER TABLE "Student" ADD COLUMN "mentorAcademicNote" TEXT;
ALTER TABLE "Student" ADD COLUMN "lastAcademicUpdate" DATETIME;
