-- CreateTable
CREATE TABLE "RiskModelConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL DEFAULT 1,
    "weights" JSON NOT NULL,
    "thresholds" JSON NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "RiskModelConfig_active_idx" ON "RiskModelConfig" ("active");