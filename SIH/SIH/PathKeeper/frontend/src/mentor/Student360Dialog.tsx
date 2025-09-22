import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Stack, Chip, CircularProgress, Divider, Paper, ToggleButtonGroup, ToggleButton, Skeleton } from '@mui/material';
import { fetchStudent360, Student360Data } from './student360Api';
import RiskBadge from '../components/RiskBadge';

interface Props { open:boolean; onClose:()=>void; token:string; studentId:string|null }

const Student360Dialog: React.FC<Props> = ({ open, onClose, token, studentId }) => {
  const [data, setData] = useState<Student360Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  useEffect(()=> {
    if (open && studentId) {
      setLoading(true); setError(null); setData(null);
      fetchStudent360(token, studentId)
        .then(d=> setData(d))
        .catch(e=> setError(e.message))
        .finally(()=> setLoading(false));
    }
  }, [open, studentId, token]);
  const riskScore = data?.student.riskScore;
  const trend = data?.trend || [];

  function relativeTime(ts: string | Date): string {
    const d = new Date(ts);
    const diffMs = Date.now() - d.getTime();
    const abs = Math.abs(diffMs);
    const sec = Math.round(abs/1000);
    if (sec < 60) return diffMs >=0 ? `${sec}s ago` : `in ${sec}s`;
    const min = Math.round(sec/60); if (min < 60) return diffMs>=0 ? `${min}m ago` : `in ${min}m`;
    const hr = Math.round(min/60); if (hr < 24) return diffMs>=0 ? `${hr}h ago` : `in ${hr}h`;
    const day = Math.round(hr/24); if (day < 7) return diffMs>=0 ? `${day}d ago` : `in ${day}d`;
    return d.toLocaleDateString();
  }

  const timelineItems = useMemo(()=> {
    if (!data) return [] as { ts:string; type:string; title:string; detail:string }[];
    const items = [
      ...(data.assignments||[]).map(a => ({ ts: a.createdAt || a.createdAt, type:'playbook', title:`Playbook Assigned: ${a.playbook?.title || 'Unknown'}`, detail: a.status })),
      ...(data.notes||[]).map(n=> ({ ts: n.createdAt, type:'note', title:'Mentor Note', detail: n.note })),
      ...(data.meetings||[]).map(m=> ({ ts: m.startsAt, type:'meeting', title:`Meeting: ${m.title}`, detail: m.status }))
    ].sort((a,b)=> new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return items;
  }, [data]);

  const filteredTimeline = useMemo(()=> {
    if (timelineFilter==='all') return timelineItems;
    return timelineItems.filter(i=> i.type===timelineFilter);
  }, [timelineFilter, timelineItems]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Student 360° Profile</DialogTitle>
      <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2 }}>
        {loading && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography variant="body2">Loading profile...</Typography></Stack>
            <Skeleton variant="rectangular" height={54} />
            <Skeleton variant="text" />
            <Skeleton variant="rectangular" height={80} />
            <Skeleton variant="rectangular" height={160} />
          </Stack>
        )}
        {error && <Typography variant="body2" color="error">{error}</Typography>}
        {data && (
          <>
            <Stack direction={{ xs:'column', sm:'row' }} spacing={2} alignItems={{ xs:'flex-start', sm:'center' }}>
              <Box sx={{ flex:1 }}>
                <Typography variant="h6" fontWeight={700}>{data.student.name}</Typography>
                <Typography variant="body2" color="text.secondary">{data.student.studentCode} • {data.student.email}</Typography>
                <Typography variant="caption" color="text.secondary">Program: {data.student.program || '—'} | Year: {data.student.year ?? '—'}</Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <RiskBadge tier={data.student.riskTier as any} />
                {riskScore != null && <Chip size="small" label={`Score ${(riskScore*100).toFixed(0)}`} />}
              </Stack>
            </Stack>
            <Divider />
            <Typography variant="subtitle2">AI Risk Summary (placeholder)</Typography>
            <Typography variant="body2" color="text.secondary">System will generate a natural language explanation of risk drivers here (attendance, performance, engagement factors, etc.).</Typography>
            <Divider />
            <Typography variant="subtitle2">Risk Trend</Typography>
            <Box sx={{ height:90 }}>
              <svg width="100%" height="100%" viewBox="0 0 320 90" preserveAspectRatio="none">
                {trend.length>1 && (()=> {
                  const w = 320; const h = 90; const max = 1; const min = 0;
                  const path = trend.map((p,i)=> {
                    const x = (i/(trend.length-1))*w;
                    const y = h - ((p.score-min)/(max-min))*h;
                    return `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                  }).join(' ');
                  return <path d={path} stroke="#2e7d32" strokeWidth={2} fill="none" strokeLinecap="round" />;
                })()}
              </svg>
            </Box>
            <Divider />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Timeline</Typography>
              <ToggleButtonGroup value={timelineFilter} exclusive size="small" onChange={(_,val)=> val && setTimelineFilter(val)}>
                <ToggleButton value="all">All</ToggleButton>
                <ToggleButton value="note">Notes</ToggleButton>
                <ToggleButton value="playbook">Playbooks</ToggleButton>
                <ToggleButton value="meeting">Meetings</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <Stack spacing={1.2} sx={{ maxHeight:240, overflowY:'auto' }} aria-label="student timeline entries">
              {filteredTimeline.slice(0,40).map((item,i)=>(
                <Paper key={i} variant="outlined" sx={{ p:1, display:'flex', flexDirection:'column', gap:0.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">{relativeTime(item.ts)}</Typography>
                    <Chip size="small" label={item.type} color={item.type==='meeting'? 'info': item.type==='playbook'? 'secondary':'default'} />
                  </Stack>
                  <Typography variant="body2" fontWeight={600}>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace:'pre-wrap' }}>{item.detail}</Typography>
                </Paper>
              ))}
              {!filteredTimeline.length && <Typography variant="body2" color="text.secondary">No entries for selected filter.</Typography>}
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
export default Student360Dialog;
