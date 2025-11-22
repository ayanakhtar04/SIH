import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Stack, Chip, CircularProgress, Divider, Paper, ToggleButtonGroup, ToggleButton, Skeleton, TextField, MenuItem } from '@mui/material';
import { fetchStudent360, Student360Data, assessDropout } from './student360Api';
import RiskBadge from '../components/RiskBadge';
import { mapBackendTier } from '../risk/riskUtil';

interface Props { open:boolean; onClose:()=>void; token:string; studentId:string|null }

const Student360Dialog: React.FC<Props> = ({ open, onClose, token, studentId }) => {
  const [data, setData] = useState<Student360Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [interventionNote, setInterventionNote] = useState<string>('');
  const [savingNote, setSavingNote] = useState<boolean>(false);
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
  // Mentor assessment (only for mentor/admin)
  const role = useMemo(()=> { try { const p = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); return p.role || p.user?.role; } catch { return undefined; } }, [token]);
  const canAssess = role === 'mentor' || role === 'admin';
  const [assess, setAssess] = useState<{
    cgpa?: number;
    attendancePercent?: number;
    feesCategory: 'paid' | 'unpaid';
    behaviorCategory: 'friendly' | 'introvert' | 'extrovert' | 'aggressive' | 'withdrawn' | 'other';
    motivationLevel: 'low' | 'medium' | 'high';
  }>({ feesCategory: 'paid', behaviorCategory: 'friendly', motivationLevel: 'medium' });
  const [assessing, setAssessing] = useState(false);
  const [tips, setTips] = useState<string[]|null>(null);
  const submitAssess = async () => {
    if (!data?.student?.id) return;
    setAssessing(true);
    try {
      // map categories -> backend numeric/enum
      const fees = assess.feesCategory === 'paid' ? 'clear' : 'due';
      const behaviorMap: Record<typeof assess.behaviorCategory, number> = {
        friendly: 8,
        extrovert: 7,
        introvert: 6,
        cooperative: 8, // fallback if we ever add it
        aggressive: 3,
        withdrawn: 2,
        other: 5
      } as any;
      const motivationMap: Record<typeof assess.motivationLevel, number> = { low: 3, medium: 6, high: 9 } as const;
      const payload = {
        cgpa: assess.cgpa,
        attendancePercent: assess.attendancePercent,
        fees,
        behavior: behaviorMap[assess.behaviorCategory] ?? 5,
        motivation: motivationMap[assess.motivationLevel]
      };
      const resp = await assessDropout(token, data.student.id, payload);
      setData(d => d ? ({ ...d, student: { ...d.student, riskScore: resp.student.riskScore, riskTier: resp.student.riskTier, lastRiskUpdated: resp.student.lastRiskUpdated } }) : d);
      setTips(resp.counseling);
      try { window.dispatchEvent(new CustomEvent('pk:students-updated')); localStorage.setItem('pk:last-students-update', String(Date.now())); } catch {}
    } catch (e:any) { alert(e.message || 'Assessment failed'); }
    finally { setAssessing(false); }
  };
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
                <Stack direction="row" spacing={1} sx={{ mt:0.5 }}>
                  {data.student.mentorName && <Chip size="small" label={`Mentor: ${data.student.mentorName}`} />}
                  {data.student.phone && <Chip size="small" label={`Phone: ${data.student.phone}`} />}
                </Stack>
                <Stack direction={{ xs:'column', sm:'row' }} spacing={1} sx={{ mt:0.5 }}>
                  {data.student.guardianName && <Chip size="small" label={`Guardian: ${data.student.guardianName}`} />}
                  {data.student.guardianEmail && <Chip size="small" label={`G Email: ${data.student.guardianEmail}`} />}
                  {data.student.guardianPhone && <Chip size="small" label={`G Phone: ${data.student.guardianPhone}`} />}
                </Stack>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <RiskBadge tier={mapBackendTier(data.student.riskTier as any) as any} />
                {riskScore != null && <Chip size="small" label={`Score ${(riskScore*100).toFixed(0)}`} />}
              </Stack>
            </Stack>
            <Divider />
            <Typography variant="subtitle2">AI Risk Summary (placeholder)</Typography>
            <Typography variant="body2" color="text.secondary">PathKeepers! has flagged this student based on current academic signals. Primary drivers will include attendance trends, assessment scores, assignment completion, and mentor notes. This section will show a plain-language explanation.</Typography>
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
            {canAssess && (
              <>
                <Typography variant="subtitle2">Mentor Dropout Assessment</Typography>
                <Stack direction={{ xs:'column', sm:'row' }} spacing={1.2}>
                  <TextField size="small" type="number" label="CGPA" value={assess.cgpa ?? ''} onChange={e=> setAssess(a=> ({ ...a, cgpa: e.target.value===''? undefined: Number(e.target.value) }))} inputProps={{ step:0.1, min:0, max:10 }} />
                  <TextField size="small" type="number" label="Attendance %" value={assess.attendancePercent ?? ''} onChange={e=> setAssess(a=> ({ ...a, attendancePercent: e.target.value===''? undefined: Number(e.target.value) }))} inputProps={{ min:0, max:100 }} />
                  <TextField size="small" select label="Fees" value={assess.feesCategory} onChange={e=> setAssess(a=> ({ ...a, feesCategory: e.target.value as any }))}>
                    <MenuItem value="paid">Paid</MenuItem>
                    <MenuItem value="unpaid">Unpaid</MenuItem>
                  </TextField>
                  <TextField size="small" select label="Behaviour" value={assess.behaviorCategory} onChange={e=> setAssess(a=> ({ ...a, behaviorCategory: e.target.value as any }))}>
                    <MenuItem value="friendly">Friendly</MenuItem>
                    <MenuItem value="introvert">Introvert</MenuItem>
                    <MenuItem value="extrovert">Extrovert</MenuItem>
                    <MenuItem value="aggressive">Aggressive</MenuItem>
                    <MenuItem value="withdrawn">Withdrawn</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </TextField>
                  <TextField size="small" select label="Motivation" value={assess.motivationLevel} onChange={e=> setAssess(a=> ({ ...a, motivationLevel: e.target.value as any }))}>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </TextField>
                  <Button variant="contained" disabled={assessing} onClick={submitAssess}>{assessing? 'Saving…':'Assess'}</Button>
                </Stack>
                {tips && (
                  <Paper variant="outlined" sx={{ p:1, mt:1 }}>
                    <Typography variant="caption" color="text.secondary">Counseling suggestions:</Typography>
                    <ul style={{ margin:0, paddingLeft:18 }}>{tips.map((t,i)=> <li key={i}><Typography variant="body2">{t}</Typography></li>)}</ul>
                  </Paper>
                )}
                <Divider />
              </>
            )}
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
            <Divider />
            <Typography variant="subtitle2">Subjects</Typography>
            <Paper variant="outlined" sx={{ p:1, maxHeight:160, overflowY:'auto' }}>
              {data.academics?.subjects && data.academics.subjects.length>0 ? (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign:'left', padding:'4px 6px' }}>Subject</th>
                      <th style={{ textAlign:'left', padding:'4px 6px' }}>Status/Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.academics.subjects.map((s:any, i:number)=> (
                      <tr key={i}>
                        <td style={{ padding:'4px 6px' }}>{s.name || s.subject || `Subject ${i+1}`}</td>
                        <td style={{ padding:'4px 6px', color:'#666' }}>{s.status || s.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Typography variant="caption" color="text.secondary">No subjects data available.</Typography>
              )}
            </Paper>
            <Divider />
            <Typography variant="subtitle2">Log Intervention</Typography>
            <Stack direction={{ xs:'column', sm:'row' }} spacing={1}>
              <TextField fullWidth size="small" label="Note" value={interventionNote} onChange={e=> setInterventionNote(e.target.value)} placeholder="e.g., Spoke with student, recommended academic support." />
              <Button variant="contained" disabled={savingNote || !interventionNote.trim()} onClick={async ()=> {
                if (!data?.student?.id) return;
                setSavingNote(true);
                try {
                  // Dispatch global event to let MentorApp handle addNote via existing quick flow or API module
                  window.dispatchEvent(new CustomEvent('pk:student-log-note', { detail: { studentId: data.student.id, note: interventionNote } }));
                  setInterventionNote('');
                } finally { setSavingNote(false); }
              }}>Log</Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt:1 }}>
              <Button size="small" variant="outlined" onClick={()=> {
                if (!data?.student?.id) return; const name = data.student.name;
                window.dispatchEvent(new CustomEvent('pk:notify', { detail: { studentIds:[data.student.id], presetBody:`Dear Guardian, we would like to discuss ${name}'s recent academic performance.` } }));
              }}>Notify Guardian</Button>
              <Button size="small" variant="outlined" onClick={()=> {
                if (!data?.student?.id) return; const name = data.student.name;
                window.dispatchEvent(new CustomEvent('pk:notify', { detail: { studentIds:[data.student.id], presetBody:`Hi ${name}, keep going—you've got this! Let us know if you need support.` } }));
              }}>Send Encouragement</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">Use the main dashboard Quick Action to attach playbooks or schedule meetings.</Typography>
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
