export type RiskTier = 'high' | 'medium' | 'low' | 'unknown';

export function deriveRiskTierFor(score: number | null | undefined): RiskTier {
  if (score == null) return 'unknown';
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}