import { Router } from 'express';
import { prisma } from './prisma/client';
import { authRequired, AuthedRequest } from './auth/middleware';
import { isAdmin } from './auth/roles';
import crypto from 'crypto';

// Because the Prisma schema currently does not successfully generate a RiskModelConfig model
// (JSON fields and relation backrefs pending), we provide a raw-SQL fallback implementation
// against a lightweight table. This keeps the API surface stable for tests and future upgrade.

const ensureTableSQL = `CREATE TABLE IF NOT EXISTS "RiskModelConfig" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "weights" TEXT NOT NULL,
  "thresholds" TEXT NOT NULL,
  "active" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME
)`;

async function ensureTable() {
  await prisma.$executeRawUnsafe(ensureTableSQL);
  // index for active lookups
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RiskModelConfig_active_idx" ON "RiskModelConfig" ("active")');
}

interface RawRiskRow {
  id: string; version: number; weights: string; thresholds: string; active: number; createdAt: string; updatedAt: string | null;
}

function parseRow(r: RawRiskRow) {
  return {
    id: r.id,
    version: r.version,
    weights: safeJSON(r.weights),
    thresholds: safeJSON(r.thresholds),
    active: !!r.active,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
}

function safeJSON(txt: string) {
  try { return JSON.parse(txt); } catch { return {}; }
}

const riskConfigRouter = Router();

// GET /api/admin/config/risk-model  -> returns active config or default
riskConfigRouter.get('/admin/config/risk-model', authRequired, async (req: AuthedRequest, res) => {
  if (!isAdmin(req.user?.role)) return res.status(403).json({ ok:false, error:'Forbidden' });
  try {
    await ensureTable();
    const rows = await prisma.$queryRawUnsafe<RawRiskRow[]>("SELECT * FROM 'RiskModelConfig' WHERE active = 1 ORDER BY createdAt DESC LIMIT 1");
    if (rows.length === 0) {
      // Create a default active row
      const id = crypto.randomUUID();
      const weights = JSON.stringify({ attendance:0.3, gpa:0.4, assignments:0.2, notes:0.1 });
      const thresholds = JSON.stringify({ high:0.7, medium:0.4 });
      await prisma.$executeRawUnsafe("INSERT INTO 'RiskModelConfig'(id, version, weights, thresholds, active, createdAt) VALUES(?, 1, ?, ?, 1, CURRENT_TIMESTAMP)", id, weights, thresholds);
      const inserted = await prisma.$queryRawUnsafe<RawRiskRow[]>("SELECT * FROM 'RiskModelConfig' WHERE id = ?", id);
      return res.json({ ok:true, config: parseRow(inserted[0]) });
    }
    return res.json({ ok:true, config: parseRow(rows[0]) });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error:'Failed to load config', detail: e.message });
  }
});

// PUT /api/admin/config/risk-model  { weights, thresholds }
riskConfigRouter.put('/admin/config/risk-model', authRequired, async (req: AuthedRequest, res) => {
  if (!isAdmin(req.user?.role)) return res.status(403).json({ ok:false, error:'Forbidden' });
  const { weights, thresholds } = req.body || {};
  if (typeof weights !== 'object' || typeof thresholds !== 'object') {
    return res.status(400).json({ ok:false, error:'weights and thresholds objects required' });
  }
  try {
    await ensureTable();
    // deactivate old
    await prisma.$executeRawUnsafe("UPDATE 'RiskModelConfig' SET active = 0 WHERE active = 1");
    const id = crypto.randomUUID();
    const weightsStr = JSON.stringify(weights);
    const thresholdsStr = JSON.stringify(thresholds);
  const prev = await prisma.$queryRawUnsafe<any[]>("SELECT MAX(version) as maxVersion FROM 'RiskModelConfig'");
  const maxVersion = prev && prev.length > 0 && typeof prev[0].maxVersion === 'number' ? prev[0].maxVersion : 0;
  const nextVersion = maxVersion + 1;
    await prisma.$executeRawUnsafe("INSERT INTO 'RiskModelConfig'(id, version, weights, thresholds, active, createdAt, updatedAt) VALUES(?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", id, nextVersion, weightsStr, thresholdsStr);
    const row = await prisma.$queryRawUnsafe<RawRiskRow[]>("SELECT * FROM 'RiskModelConfig' WHERE id = ?", id);
    return res.json({ ok:true, config: parseRow(row[0]) });
  } catch (e:any) {
    console.error('RiskModelConfig PUT error', e);
    return res.status(500).json({ ok:false, error:'Failed to save config', detail: e.message });
  }
});

export default riskConfigRouter;
