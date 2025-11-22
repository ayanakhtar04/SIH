import React from 'react';
import { Box, Grid, Paper, Typography, useTheme, Chip, Divider } from '@mui/material';

interface KPI { label: string; value: string | number; delta?: number; }

const kpis: KPI[] = [
  { label: 'Active Courses', value: 6, delta: 1 },
  { label: 'Attendance', value: '92%', delta: -2 },
  { label: 'Risk Score', value: 24, delta: -4 },
  { label: 'GPA (Proj.)', value: 3.4, delta: 0.1 }
];

// Simple mock time-series
const mockSeries = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, risk: Math.max(5, 40 - i * 2 + (i % 3) * 3) }));

export const StudentDashboard: React.FC<{ onLogout: () => void; }> = ({ onLogout }) => {
  const theme = useTheme();

  return (
    <Box sx={{ width:'100%', maxWidth:1200, mx:'auto', p:4 }}>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:4 }}>
        <Typography variant="h4" fontWeight={700}>Student Overview</Typography>
        <Chip color="primary" label="Sandbox" variant="outlined" onDelete={onLogout} deleteIcon={<span style={{ padding:'0 4px', fontSize:12 }}>Logout</span>} />
      </Box>
      <Grid container spacing={3}>
        {kpis.map(k => (
          <Grid item xs={12} sm={6} md={3} key={k.label}>
            <Paper elevation={3} style={{ padding:16, borderRadius:18, background: theme.palette.mode==='dark'? '#1e1f22':'linear-gradient(145deg,#ffffff,#f3f5f7)' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>{k.label}</Typography>
              <Typography variant="h5" fontWeight={700}>{k.value}</Typography>
              {k.delta !== undefined && (
                <Typography variant="caption" color={k.delta >=0 ? 'success.main':'error.main'}>{k.delta >=0 ? '+':''}{k.delta}</Typography>
              )}
            </Paper>
          </Grid>
        ))}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} style={{ padding:20, borderRadius:18, height:360, display:'flex', flexDirection:'column' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Risk Trend (Mock)</Typography>
            <Box sx={{ flex:1, position:'relative', mt:1 }}>
              <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="riskGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={theme.palette.error.main} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={theme.palette.warning.main} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <rect x={0} y={0} width={400} height={200} fill={theme.palette.mode==='dark'? '#121212':'#ffffff'} />
                {mockSeries.map((pt,i) => {
                  if (i === 0) return null; const prev = mockSeries[i-1];
                  const x1 = ((prev.m -1)/11)*400; const x2 = ((pt.m -1)/11)*400;
                  const y1 = 200 - (prev.risk/50)*180 - 10; const y2 = 200 - (pt.risk/50)*180 - 10;
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.palette.error.main} strokeWidth={3} strokeLinecap="round" />;
                })}
                {mockSeries.map((pt,i) => {
                  const x = ((pt.m -1)/11)*400; const y = 200 - (pt.risk/50)*180 - 10;
                  return <circle key={i} cx={x} cy={y} r={4} fill={theme.palette.error.main} />;
                })}
              </svg>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} style={{ padding:20, borderRadius:18, height:360, display:'flex', flexDirection:'column' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Alerts (Sample)</Typography>
            <Divider sx={{ mb:1.5 }} />
            <Box sx={{ display:'flex', flexDirection:'column', gap:1, overflowY:'auto' }}>
              {['Attendance dip below 90%','Assignment 3 missing','Low engagement last week'].map((a,i)=>(
                <Paper key={i} variant="outlined" sx={{ p:1.2, fontSize:13, borderRadius:2 }}>{a}</Paper>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
