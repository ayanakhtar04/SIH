import React from 'react';
import { Chip, useTheme } from '@mui/material';
import { TOKENS, RiskTierToken } from './DesignTokens';

interface RiskBadgeProps { tier: RiskTierToken; size?: 'small' | 'medium'; }

export const RiskBadge: React.FC<RiskBadgeProps> = ({ tier, size='small' }) => {
  const theme = useTheme();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';
  const label = TOKENS.risk.labelMap[tier];
  // Map tiers to MUI Chip colors; medium -> warning (outlined), high -> error, low -> success, unknown -> default
  const chipColor: any = tier === 'High' ? 'error' : tier === 'Medium' ? 'warning' : tier === 'Low' ? 'success' : 'default';
  const variant = tier === 'Medium' ? 'outlined' : 'filled';
  return <Chip size={size} label={label} color={chipColor} variant={variant} sx={{ fontWeight:600 }} />;
};

export default RiskBadge;