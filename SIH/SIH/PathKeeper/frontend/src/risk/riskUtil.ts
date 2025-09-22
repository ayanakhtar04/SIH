// Shared risk utility: normalizes backend riskScore/riskTier and provides
// a fallback synthetic calculator for legacy placeholder metric sets.

export type BackendRiskTier = 'high' | 'medium' | 'low' | 'unknown';
export type DisplayRiskTier = 'High' | 'Medium' | 'Low' | 'Unknown';

export interface NormalizedRisk {
  level: DisplayRiskTier;    // For UI labels
  score: number | null;      // 0-100 scale for visual consistency
  backendScore?: number | null; // original 0-1 riskScore if provided
  color: string;             // semantic color hex (fallbacks kept simple)
  chipColor: 'error' | 'warning' | 'success' | 'default';
}

export function mapBackendTier(tier?: BackendRiskTier | string | null | undefined): DisplayRiskTier {
  if (!tier) return 'Unknown';
  const t = String(tier).toLowerCase();
  if (t === 'high') return 'High';
  if (t === 'medium') return 'Medium';
  if (t === 'low') return 'Low';
  return 'Unknown';
}

export function deriveTierFromScore(score: number | null | undefined): DisplayRiskTier {
  if (score == null) return 'Unknown';
  if (score >= 0.7) return 'High';
  if (score >= 0.4) return 'Medium';
  return 'Low';
}

export function tierColors(tier: DisplayRiskTier): { color: string; chipColor: NormalizedRisk['chipColor'] } {
  switch (tier) {
    case 'High': return { color: '#d32f2f', chipColor: 'error' };
    case 'Medium': return { color: '#ed6c02', chipColor: 'warning' };
    case 'Low': return { color: '#2e7d32', chipColor: 'success' };
    default: return { color: '#6b7280', chipColor: 'default' };
  }
}

// Fallback synthetic calculator replicating earlier heuristic (0-100)
export function syntheticRiskFromMetrics(metrics: { attendance: number; gpa: number; assignmentsSubmitted: number; }): { level: DisplayRiskTier; score: number } {
  const { attendance, gpa, assignmentsSubmitted } = metrics;
  let score = 0;
  if (attendance < 60) score += 40; else if (attendance < 75) score += 25;
  if (gpa < 2.0) score += 40; else if (gpa < 2.5) score += 25;
  if (assignmentsSubmitted < 50) score += 30; else if (assignmentsSubmitted < 70) score += 15;
  let level: DisplayRiskTier = 'Low';
  if (score >= 80) level = 'High'; else if (score >= 40) level = 'Medium';
  return { level, score };
}

export function normalizeRisk(opts: { backendScore?: number | null; backendTier?: BackendRiskTier | string | null; fallbackMetrics?: { attendance: number; gpa: number; assignmentsSubmitted: number }; }): NormalizedRisk {
  const { backendScore, backendTier, fallbackMetrics } = opts;
  if (backendScore != null && !isNaN(backendScore)) {
    const tier = mapBackendTier(backendTier) === 'Unknown' ? deriveTierFromScore(backendScore) : mapBackendTier(backendTier);
    const { color, chipColor } = tierColors(tier);
    return {
      level: tier,
      score: Math.round(Math.min(Math.max(backendScore, 0), 1) * 100),
      backendScore,
      color,
      chipColor
    };
  }
  if (fallbackMetrics) {
    const syn = syntheticRiskFromMetrics(fallbackMetrics);
    const { color, chipColor } = tierColors(syn.level);
    return { level: syn.level, score: syn.score, backendScore: null, color, chipColor };
  }
  const { color, chipColor } = tierColors('Unknown');
  return { level: 'Unknown', score: null, backendScore: null, color, chipColor };
}
