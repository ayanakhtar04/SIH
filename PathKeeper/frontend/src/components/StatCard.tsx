import React from 'react';
import { Paper, Stack, Typography, Box } from '@mui/material';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color?: string;
  elevation?: number;
  minHeight?: number;
}

// Shared StatCard component replacing duplicated inline variants in Admin/Mentor/Student dashboards.
export const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon, color, elevation = 0, minHeight }) => {
  return (
    <Paper elevation={elevation} sx={{ p: 2.5, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 1, minHeight }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
        <Typography variant="subtitle2" color="text.secondary" noWrap>{title}</Typography>
        <Box sx={{ p: 1, borderRadius: 2, bgcolor: (theme) => color ? color : theme.palette.action.hover, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</Box>
      </Stack>
      <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.15 }}>{value}</Typography>
      {change && <Typography variant="caption" color="text.secondary" noWrap>{change}</Typography>}
    </Paper>
  );
};

export default StatCard;
