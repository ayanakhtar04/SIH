export type RiskTier = 'high' | 'medium' | 'low' | 'unknown';

export function deriveRiskTierFor(score: number | null | undefined): RiskTier {
  if (score == null) return 'unknown';
  // High threshold tuned from 0.70 -> 0.65 to better capture severe low-attendance/low-GPA/no-assignments cases
  if (score >= 0.65) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}