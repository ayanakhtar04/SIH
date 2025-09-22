// Central design tokens for spacing, radii, colors, risk tiers.
// Extend/override via MUI theme if needed, but keep a pure object for non-MUI code reuse.

export const TOKENS = {
  spacing: (factor: number) => factor * 4,
  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 18,
  },
  risk: {
    tiers: ['High','Medium','Low','Unknown'] as const,
    colors: {
      High: { light: '#d32f2f', dark: '#ef5350' },
      Medium: { light: '#ed6c02', dark: '#ff9800' },
      Low: { light: '#2e7d32', dark: '#66bb6a' },
      Unknown: { light: '#757575', dark: '#9e9e9e' }
    },
    labelMap: {
      High: 'High Risk',
      Medium: 'Medium Risk',
      Low: 'Low Risk',
      Unknown: 'Unknown Risk'
    }
  }
} as const;

export type RiskTierToken = keyof typeof TOKENS.risk.colors;

export function riskColor(tier: RiskTierToken, mode: 'light' | 'dark' = 'light') {
  return TOKENS.risk.colors[tier][mode];
}

export function riskLabel(tier: RiskTierToken) {
  return TOKENS.risk.labelMap[tier];
}
