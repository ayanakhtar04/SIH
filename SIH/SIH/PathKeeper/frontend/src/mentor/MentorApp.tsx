import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeRisk } from '../risk/riskUtil';
import { useDarkMode } from '../theme/DarkModeContext';
import { Box, Stack, Typography, Paper, Button, IconButton, Avatar, Chip, Divider, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel, CircularProgress, Snackbar, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import RiskBadge from '../components/RiskBadge';
import StatCard from '../components/StatCard';
import { useAuth } from '../auth/AuthContext';
import { listPlaybooks, assignPlaybook, addNote, Playbook } from './playbookApi';
import { listStudentMeetings, createMeeting, cancelMeeting, Meeting } from './meetingsApi';
import Student360Dialog from './Student360Dialog';
import ManageStudentsPage from './ManageStudentsPage';
import NotificationModal from './NotificationModal';
import { API } from '../api';

// Local synthetic calc removed in favor of shared util

interface MentorStudent {
  id: string; name: string; email: string; attendance: number; gpa: number; assignmentsSubmitted: number; lastExamScore: number; performanceHistory: { month: string; score: number }[]; risk:{ level:string; score:number };
}

// Local RiskBadge replaced with shared component


const PerformanceTrend: React.FC<{ data: { month:string; score:number }[] }> = ({ data }) => (
  <Box sx={{ height:260 }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: -5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <ReTooltip />
        <Line type="monotone" dataKey="score" stroke="#2e7d32" strokeWidth={2} activeDot={{ r: 7 }} />
      </LineChart>
    </ResponsiveContainer>
  </Box>
);

const DashboardPage: React.FC<{ token:string; students: MentorStudent[]; onExport: () => void; exporting: boolean }> = ({ token, students, onExport, exporting }) => {
  const highRisk = students.filter(s => s.risk.level === 'High').length;
  const avgAttendance = students.length ? Math.round(students.reduce((acc,s)=> acc+s.attendance,0)/students.length) : 0;
  const [filter, setFilter] = useState<'All'|'High'|'Medium'|'Low'>('All');
  const [sort, setSort] = useState<'name'|'risk'|'attendance'>('risk');
  const [quick, setQuick] = useState<MentorStudent | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [playbooksLoading, setPlaybooksLoading] = useState(false);
  const [playbookId, setPlaybookId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg:string; sev:'success'|'error' }|null>(null);
  // Meetings state
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [mtTitle, setMtTitle] = useState('');
  const [mtDate, setMtDate] = useState('');
  const [mtStart, setMtStart] = useState('');
  const [mtDuration, setMtDuration] = useState(30);
  const [mtLocation, setMtLocation] = useState('');
  const [mtNotes, setMtNotes] = useState('');
  const [show360, setShow360] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [bulkNotifyOpen, setBulkNotifyOpen] = useState(false);

  // Load playbooks & meetings on first modal open
  useEffect(()=> {
    if (quick && playbooks.length === 0 && !playbooksLoading) {
      setPlaybooksLoading(true);
      listPlaybooks(token, { all:false })
        .then(r=> setPlaybooks(r.playbooks))
        .catch(()=> setPlaybooks([]))
        .finally(()=> setPlaybooksLoading(false));
    }
    if (quick && meetings.length === 0 && !meetingsLoading) {
      setMeetingsLoading(true);
      listStudentMeetings(token, quick.id)
        .then(r=> setMeetings(r.meetings))
        .catch(()=> setMeetings([]))
        .finally(()=> setMeetingsLoading(false));
    }
  }, [quick, playbooks.length, playbooksLoading, token, meetings.length, meetingsLoading]);

  const handleSaveQuick = async () => {
    if (!quick) return;
    if (!note.trim() && !playbookId) { setToast({ msg:'Nothing to save', sev:'error' }); return; }
    setSaving(true);
    try {
      if (playbookId) {
        await assignPlaybook(token, { studentId: quick.id, playbookId, notes: note.trim() ? note.trim() : undefined });
      } else if (note.trim()) {
        await addNote(token, { studentId: quick.id, note: note.trim() });
      }
      setToast({ msg:'Saved', sev:'success' });
      setQuick(null);
      setPlaybookId('');
      setNote('');
    } catch(e:any) {
      setToast({ msg: e.message || 'Failed', sev:'error' });
    } finally { setSaving(false); }
  };

  const handleSchedule = async () => {
    if (!quick || !mtTitle || !mtDate || !mtStart) { setToast({ msg:'Missing meeting fields', sev:'error' }); return; }
    const starts = new Date(`${mtDate}T${mtStart}:00`);
    const ends = new Date(starts.getTime() + mtDuration*60000);
    if (isNaN(starts.getTime()) || isNaN(ends.getTime())) { setToast({ msg:'Invalid date/time', sev:'error' }); return; }
    setSaving(true);
    try {
      const r = await createMeeting(token, { studentId: quick.id, title: mtTitle, startsAt: starts.toISOString(), endsAt: ends.toISOString(), location: mtLocation || undefined, notes: mtNotes || undefined });
      setMeetings(m=> [...m, r.meeting].sort((a,b)=> a.startsAt.localeCompare(b.startsAt)));
      setToast({ msg:'Meeting scheduled', sev:'success' });
      setMtTitle(''); setMtDate(''); setMtStart(''); setMtDuration(30); setMtLocation(''); setMtNotes('');
    } catch(e:any) { setToast({ msg:e.message || 'Schedule failed', sev:'error' }); }
    finally { setSaving(false); }
  };

  const handleCancelMeeting = async (id:string) => {
    setSaving(true);
    try {
      const r = await cancelMeeting(token, id);
      setMeetings(ms => ms.map(m=> m.id===id? r.meeting : m));
      setToast({ msg:'Meeting cancelled', sev:'success' });
    } catch(e:any) { setToast({ msg:e.message || 'Cancel failed', sev:'error' }); }
    finally { setSaving(false); }
  };
  const filtered = students.filter(s => filter==='All' || s.risk.level===filter);
  const sorted = [...filtered].sort((a,b)=> {
    if (sort==='name') return a.name.localeCompare(b.name);
    if (sort==='attendance') return b.attendance - a.attendance;
    return b.risk.score - a.risk.score; // risk
  });

  const toggleSelect = (id:string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => { setSelected(new Set()); setSelectMode(false); };

  // Bulk actions state
  const [bulkNote, setBulkNote] = useState('');
  const [bulkPlaybookId, setBulkPlaybookId] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const handleBulkApply = async () => {
    if (selected.size === 0) return;
    if (!bulkPlaybookId && !bulkNote.trim()) { setToast({ msg:'Nothing to apply', sev:'error' }); return; }
    setBulkSaving(true);
    try {
      const ids = Array.from(selected);
      for (const id of ids) {
        if (bulkPlaybookId) {
          await assignPlaybook(token, { studentId: id, playbookId: bulkPlaybookId, notes: bulkNote.trim() || undefined });
        } else if (bulkNote.trim()) {
          await addNote(token, { studentId: id, note: bulkNote.trim() });
        }
      }
      setToast({ msg:'Bulk action applied', sev:'success' });
      setBulkNote(''); setBulkPlaybookId(''); clearSelection();
    } catch(e:any) { setToast({ msg: e.message || 'Bulk failed', sev:'error' }); }
    finally { setBulkSaving(false); }
  };
  return (
    <Stack spacing={4}>
      <Stack direction={{ xs:'column', md:'row' }} alignItems={{ xs:'flex-start', md:'center' }} justifyContent="space-between" spacing={2}>
        <Typography variant="h4" fontWeight={700}>Mentor Dashboard</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth:110 }}>
            <InputLabel>Risk</InputLabel>
            <Select label="Risk" value={filter} onChange={e=> setFilter(e.target.value as any)}>
              {['All','High','Medium','Low'].map(r=> <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth:130 }}>
            <InputLabel>Sort</InputLabel>
            <Select label="Sort" value={sort} onChange={e=> setSort(e.target.value as any)}>
              <MenuItem value="risk">Risk Score</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="attendance">Attendance</MenuItem>
            </Select>
          </FormControl>
          <Button size="small" variant="outlined" disabled={!students.length || exporting} onClick={onExport}>{exporting? 'Exporting…':'Export CSV'}</Button>
          <Button size="small" variant={selectMode? 'contained':'outlined'} color={selectMode? 'secondary':'inherit'} onClick={()=> { if (selectMode) { clearSelection(); } else { setSelectMode(true); } }}>
            {selectMode? `Cancel (${selected.size})` : 'Select'}
          </Button>
        </Stack>
      </Stack>
      <Box sx={{ display:'grid', gap:3, gridTemplateColumns:{ xs:'repeat(auto-fill,minmax(240px,1fr))', md:'repeat(auto-fill,minmax(260px,1fr))' } }}>
        {sorted.map(s => (
          <Paper key={s.id} elevation={0} sx={{ p:2, border: t=>`1px solid ${selected.has(s.id)? t.palette.primary.main : t.palette.divider}`, borderRadius:3, display:'flex', flexDirection:'column', gap:1.25, position:'relative' }}>
            {selectMode && (
              <Box sx={{ position:'absolute', top:8, left:8 }}>
                <input type="checkbox" checked={selected.has(s.id)} onChange={()=> toggleSelect(s.id)} />
              </Box>
            )}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor:'primary.main', width:46, height:46 }}>{s.name.charAt(0)}</Avatar>
              <Box sx={{ minWidth:0, flex:1 }}>
                <Typography variant="subtitle2" fontWeight={600} noWrap>{s.name}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>{s.id}</Typography>
              </Box>
              <RiskBadge tier={s.risk.level as any} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap:'wrap' }}>
              <Chip size="small" label={`Att ${s.attendance}%`} />
              <Chip size="small" label={`GPA ${s.gpa.toFixed(1)}`} />
              <Chip size="small" label={`Assign ${s.assignmentsSubmitted}`} />
            </Stack>
            {!selectMode && <Button size="small" variant="contained" onClick={()=> setQuick(s)} sx={{ mt:0.5 }}>Quick Action</Button>}
            {selectMode && <Button size="small" variant={selected.has(s.id)? 'contained':'outlined'} onClick={()=> toggleSelect(s.id)} sx={{ mt:0.5 }}>{selected.has(s.id)? 'Selected':'Select'}</Button>}
          </Paper>
        ))}
        {!sorted.length && <Typography variant="body2" color="text.secondary">No students match filter.</Typography>}
      </Box>
      <Paper elevation={0} sx={{ p:2, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3, display:'flex', gap:2, flexWrap:'wrap' }}>
        <StatCard title="Assigned Students" value={students.length} icon={<GroupIcon fontSize="small" />} />
        <StatCard title="High-Risk" value={highRisk} change="Needs attention" icon={<WarningRoundedIcon fontSize="small" />} />
        <StatCard title="Avg. Attendance" value={`${avgAttendance}%`} change="Cohort" icon={<CheckCircleOutlineIcon fontSize="small" />} />
      </Paper>
      <Dialog open={!!quick} onClose={()=> { if(!saving) setQuick(null); }} fullWidth maxWidth="sm">
        <DialogTitle>Quick Action{quick? `: ${quick.name}`:''}</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2 }}>
          <Typography variant="body2" color="text.secondary">Assign a playbook and/or add a note for this student.</Typography>
          <TextField label="Note" value={note} onChange={e=> setNote(e.target.value)} placeholder="Observation / planned intervention" multiline minRows={3} fullWidth disabled={saving} />
          <FormControl fullWidth size="small" disabled={saving || playbooksLoading}>
            <InputLabel>Playbook</InputLabel>
            <Select label="Playbook" value={playbookId} onChange={e=> setPlaybookId(e.target.value)} renderValue={(val)=> {
              const pb = playbooks.find(p=> p.id===val);
              return pb? pb.title : '';
            }}>
              <MenuItem value=""><em>None</em></MenuItem>
              {playbooks.map(pb => <MenuItem key={pb.id} value={pb.id}>{pb.title}</MenuItem>)}
              {(!playbooksLoading && playbooks.length===0) && <MenuItem disabled value="__empty">No playbooks</MenuItem>}
            </Select>
          </FormControl>
          {playbooksLoading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={16} /><Typography variant="caption">Loading playbooks…</Typography></Stack>}
          <Divider sx={{ my:1.5 }} />
            <Typography variant="subtitle2">Schedule Meeting</Typography>
            <Stack direction={{ xs:'column', sm:'row' }} spacing={1}>
              <TextField label="Title" value={mtTitle} onChange={e=> setMtTitle(e.target.value)} fullWidth size="small" disabled={saving} />
              <TextField label="Date" type="date" value={mtDate} onChange={e=> setMtDate(e.target.value)} InputLabelProps={{ shrink:true }} size="small" disabled={saving} />
              <TextField label="Start" type="time" value={mtStart} onChange={e=> setMtStart(e.target.value)} InputLabelProps={{ shrink:true }} size="small" disabled={saving} />
              <TextField label="Duration" type="number" value={mtDuration} onChange={e=> setMtDuration(Math.max(5,Math.min(480, Number(e.target.value)||30)))} size="small" disabled={saving} sx={{ maxWidth:120 }} />
            </Stack>
            <Stack direction={{ xs:'column', sm:'row' }} spacing={1}>
              <TextField label="Location" value={mtLocation} onChange={e=> setMtLocation(e.target.value)} fullWidth size="small" disabled={saving} />
              <TextField label="Notes" value={mtNotes} onChange={e=> setMtNotes(e.target.value)} fullWidth size="small" disabled={saving} />
            </Stack>
            <Button size="small" variant="outlined" onClick={handleSchedule} disabled={saving || !mtTitle || !mtDate || !mtStart}>Schedule</Button>
            <Stack spacing={1} sx={{ maxHeight:160, overflowY:'auto' }}>
              <Typography variant="caption" color="text.secondary">Upcoming / Recent</Typography>
              {meetingsLoading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={14} /><Typography variant="caption">Loading meetings…</Typography></Stack>}
              {!meetingsLoading && meetings.filter(m=> m.status!=='cancelled').slice(0,4).map(m => (
                <Paper key={m.id} variant="outlined" sx={{ p:0.75, display:'flex', flexDirection:'column', gap:0.25 }}>
                  <Typography variant="caption" sx={{ fontWeight:600 }}>{m.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(m.startsAt).toLocaleString()} ({Math.round((new Date(m.endsAt).getTime()-new Date(m.startsAt).getTime())/60000)}m)</Typography>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Chip size="small" label={m.status} color={m.status==='scheduled'? 'info': (m.status==='cancelled'?'default':'success')} />
                    {m.status==='scheduled' && <Button size="small" onClick={()=> handleCancelMeeting(m.id)} disabled={saving}>Cancel</Button>}
                  </Stack>
                </Paper>
              ))}
              {!meetingsLoading && meetings.filter(m=> m.status!=='cancelled').length===0 && <Typography variant="caption" color="text.secondary">No meetings</Typography>}
            </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setShow360(true)} disabled={!quick || saving}>360° View</Button>
          <Button onClick={()=> setNotifyOpen(true)} disabled={!quick || saving}>Notify</Button>
          <Button onClick={()=> !saving && setQuick(null)} disabled={saving}>Close</Button>
          <Button variant="contained" onClick={handleSaveQuick} disabled={saving || (!playbookId && !note.trim())}>{saving? 'Saving...':'Save'}</Button>
        </DialogActions>
      </Dialog>
      <Student360Dialog open={show360} onClose={()=> setShow360(false)} token={token} studentId={quick? quick.id: null} />
      <NotificationModal open={notifyOpen} onClose={()=> setNotifyOpen(false)} token={token} studentIds={quick? [quick.id]: undefined} singleStudentName={quick?.name} />
      {selectMode && selected.size > 0 && (
        <Paper elevation={6} sx={{ position:'fixed', bottom:16, left:16, right:16, p:2, borderRadius:3, display:'flex', flexDirection:{ xs:'column', md:'row' }, gap:2, alignItems:{ xs:'stretch', md:'center' } }}>
          <Typography variant="subtitle2" sx={{ flexShrink:0 }}>{selected.size} selected</Typography>
          <TextField size="small" label="Bulk Note" value={bulkNote} onChange={e=> setBulkNote(e.target.value)} multiline minRows={1} sx={{ flex:1 }} disabled={bulkSaving} />
          <FormControl size="small" sx={{ minWidth:160 }} disabled={bulkSaving || playbooksLoading}>
            <InputLabel>Playbook</InputLabel>
            <Select label="Playbook" value={bulkPlaybookId} onChange={e=> setBulkPlaybookId(e.target.value)}>
              <MenuItem value=""><em>None</em></MenuItem>
              {playbooks.map(pb => <MenuItem key={pb.id} value={pb.id}>{pb.title}</MenuItem>)}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={clearSelection} disabled={bulkSaving}>Clear</Button>
            <Button size="small" variant="outlined" onClick={()=> setBulkNotifyOpen(true)} disabled={bulkSaving}>Notify</Button>
            <Button size="small" variant="contained" onClick={handleBulkApply} disabled={bulkSaving || (!bulkPlaybookId && !bulkNote.trim())}>{bulkSaving? 'Applying...':'Apply'}</Button>
          </Stack>
        </Paper>
      )}
      <NotificationModal open={bulkNotifyOpen} onClose={()=> setBulkNotifyOpen(false)} token={token} studentIds={Array.from(selected)} />
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={()=> setToast(null)} anchorOrigin={{ vertical:'bottom', horizontal:'center' }}>
        {toast && <Alert severity={toast.sev} onClose={()=> setToast(null)} variant="filled">{toast.msg}</Alert>}
      </Snackbar>
    </Stack>
  );
};

const ProfilePage = () => (
  <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
    <Typography variant="h5" fontWeight={700} mb={1}>My Profile</Typography>
    <Typography variant="body2" color="text.secondary">Profile settings and user information will be displayed here.</Typography>
  </Paper>
);

const SettingsPage: React.FC = () => {
  const { dark, toggleDark } = useDarkMode();
  return (
    <Stack spacing={4}>
      <Typography variant="h4" fontWeight={700}>Settings</Typography>
      <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>Appearance</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>Choose how the dashboard looks.</Typography>
        <Stack direction={{ xs:'column', sm:'row' }} spacing={2}>
          {/* Light button only toggles when currently dark */}
          <Button fullWidth variant={!dark? 'contained':'outlined'} onClick={()=> dark && toggleDark()}>Light Mode</Button>
          {/* Dark button only toggles when currently light */}
          <Button fullWidth variant={dark? 'contained':'outlined'} onClick={()=> !dark && toggleDark()}>Dark Mode</Button>
        </Stack>
      </Paper>
    </Stack>
  );
};

const MentorApp: React.FC = () => {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [page, setPage] = useState<'dashboard'|'manage'|'profile'|'settings'>('dashboard');
  // dark mode handled globally via context
  const [students, setStudents] = useState<MentorStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|undefined>();
  const [exporting, setExporting] = useState(false);
  const decodedRole = useMemo(()=> { try { if (!session?.token) return undefined; const p = JSON.parse(atob(session.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); return p.role || p.user?.role; } catch { return undefined; } }, [session]);

  const allowed = ['mentor','teacher','counselor','admin'];
  if (!session) return <Box p={4}><Typography>Not authenticated</Typography></Box>;
  if (!decodedRole || !allowed.includes(decodedRole)) return <Box p={4}><Typography variant="h5" fontWeight={700}>Forbidden</Typography><Typography variant="body2" color="text.secondary">Mentor or counselor role required.</Typography></Box>;

  const synthPerformance = (base:number) => [ 'Jan','Feb','Mar','Apr','May','Jun' ].map((m,i)=> ({ month:m, score: Math.max(40, Math.min(100, base + Math.sin(i+1)*8 - i*2)) }));

  const fetchStudents = useCallback(()=> {
    if (!session?.token) return;
    setLoading(true); setErr(undefined);
    fetch(`${API.students}?page=1&pageSize=40`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r=> { if(!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then(json => {
        const raw = json.data || json.students || [];
        const mapped: MentorStudent[] = raw.map((s:any,i:number)=> {
          // Synthetic academic metrics (placeholders until real fields exist)
          const attendance = 65 + ((i*19)%30);
          const gpa = 2.2 + ((i*7)%15)/10; // 2.2 - 3.7
          const assignmentsSubmitted = 55 + ((i*11)%45);
          const lastExamScore = 50 + ((i*13)%50);
          const norm = normalizeRisk({ backendScore: s.riskScore, backendTier: s.riskTier, fallbackMetrics: { attendance, gpa, assignmentsSubmitted } });
          return {
            id: s.id || `mstu-${i}`,
            name: s.name || `Student ${i+1}`,
            email: s.email || `student${i+1}@example.com`,
            attendance,
            gpa,
            assignmentsSubmitted,
            lastExamScore,
            performanceHistory: synthPerformance(60 + ((i*5)%30)),
            risk: { level: norm.level, score: norm.score ?? 0 }
          };
        });
        setStudents(mapped);
      })
      .catch(e=> setErr(e.message))
      .finally(()=> setLoading(false));
  }, [session]);

  useEffect(()=> { fetchStudents(); }, [fetchStudents]);

  function buildCsv(rows: MentorStudent[]): string {
    const header = ['id','name','email','attendance','gpa','assignmentsSubmitted','lastExamScore','riskLevel','riskScore'];
    const escape = (v:any)=> {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? '"'+ s.replace(/"/g,'""') +'"' : s;
    };
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        r.id,
        r.name,
        r.email,
        r.attendance,
        r.gpa.toFixed(2),
        r.assignmentsSubmitted,
        r.lastExamScore,
        r.risk.level,
        r.risk.score
      ].map(escape).join(','));
    }
    return lines.join('\n');
  }

  const handleExport = () => {
    if (!students.length) return;
    try {
      setExporting(true);
      const csv = buildCsv(students);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:T]/g,'-').split('.')[0];
      a.download = `mentor_students_${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setTimeout(()=> setExporting(false), 400); // brief delay for UX
    }
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage token={session.token} students={students} onExport={handleExport} exporting={exporting} />;
      case 'manage':
        return <ManageStudentsPage token={session.token} onRiskUpdated={(id, score, tier)=> {
          setStudents(sts => sts.map(s=> s.id===id ? { ...s, risk:{ level: tier.charAt(0).toUpperCase()+tier.slice(1), score } } : s));
        }} />;
      case 'profile':
        return <ProfilePage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display:'flex', minHeight:'100vh' }}>
      <Box sx={{ width: sidebarOpen? 240: 74, transition:'width 240ms', borderRight: t=>`1px solid ${t.palette.divider}`, display:'flex', flexDirection:'column' }}>
        <Box sx={{ p:1.5, display:'flex', alignItems:'center', justifyContent: sidebarOpen? 'space-between':'center' }}>
          {sidebarOpen && <Typography variant="h6" fontWeight={700}>Mentor</Typography>}
          <IconButton size="small" onClick={()=> setSidebarOpen(o=>!o)}><MenuIcon fontSize="small" /></IconButton>
        </Box>
        <Divider />
        <Stack spacing={0.5} sx={{ p:1.5, flex:1 }}>
          <NavBtn active={page==='dashboard'} icon={<SpaceDashboardIcon fontSize="small" />} label="Mentor Dashboard" onClick={()=> setPage('dashboard')} open={sidebarOpen} />
          <NavBtn active={page==='manage'} icon={<ManageAccountsIcon fontSize="small" />} label="Manage Students" onClick={()=> setPage('manage')} open={sidebarOpen} />
          <Divider flexItem sx={{ my:1 }} />
          <NavBtn active={false} icon={<SpaceDashboardIcon fontSize="small" />} label="Overview" onClick={()=> navigate('/')} open={sidebarOpen} />
          <NavBtn active={false} icon={<SpaceDashboardIcon fontSize="small" />} label="Notifications" onClick={()=> navigate('/notifications')} open={sidebarOpen} />
          {/* Import route intentionally hidden for mentors (admin only) */}
          <Divider flexItem sx={{ my:1 }} />
          <NavBtn active={page==='profile'} icon={<PersonIcon fontSize="small" />} label="Profile" onClick={()=> setPage('profile')} open={sidebarOpen} />
          <NavBtn active={page==='settings'} icon={<SettingsIcon fontSize="small" />} label="Settings" onClick={()=> setPage('settings')} open={sidebarOpen} />
        </Stack>
        <Divider />
        <Stack spacing={1.2} sx={{ p:1.5 }}>
          <Button onClick={()=> logout()} startIcon={<LogoutIcon fontSize="small" />} size="small" variant="outlined" sx={{ justifyContent: sidebarOpen? 'flex-start':'center', borderRadius:2 }}>{sidebarOpen? 'Logout':'Out'}</Button>
        </Stack>
      </Box>
      <Box sx={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Box sx={{ position:'sticky', top:0, zIndex:5, backdropFilter:'blur(12px)', bgcolor: t=> t.palette.background.paper + 'CC', borderBottom: t=>`1px solid ${t.palette.divider}`, px:3, py:1.5, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Box sx={{ flex:1, maxWidth: sidebarOpen? 300: 240, position:'relative' }}>
            <SearchIcon fontSize="small" style={{ position:'absolute', top:8, left:8, opacity:0.55 }} />
            <input placeholder="Search..." style={{ width:'100%', padding:'8px 10px 8px 30px', borderRadius:8, outline:'none', border:'1px solid rgba(0,0,0,0.2)', background:'transparent', color:'inherit' }} />
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton size="small"><ChatBubbleOutlineIcon fontSize="small" /></IconButton>
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar sx={{ width:40, height:40, bgcolor:'primary.main' }}>{decodedRole?.charAt(0).toUpperCase() || 'M'}</Avatar>
              <Box sx={{ display:{ xs:'none', sm:'block' } }}>
                <Typography variant="subtitle2" fontWeight={600} noWrap>{decodedRole || 'Mentor'}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>{(session as any)?.email || 'mentor@example.com'}</Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ flex:1, p:{ xs:2, md:3 }, display:'flex', flexDirection:'column', gap:3, overflowY:'auto' }}>
          {loading && <Typography variant="body2">Loading students...</Typography>}
          {err && <Typography variant="body2" color="error">{err}</Typography>}
          {renderPage()}
        </Box>
      </Box>
    </Box>
  );
};

const NavBtn: React.FC<{ active:boolean; icon:React.ReactNode; label:string; onClick:()=>void; open:boolean; }> = ({ active, icon, label, onClick, open }) => (
  <Button onClick={onClick} startIcon={open? icon: undefined} size="small" variant={active? 'contained':'text'} fullWidth sx={{ justifyContent: open? 'flex-start':'center', fontWeight:600, borderRadius:2, minHeight:38 }}>{open? label: (active? icon: icon)}</Button>
);

export default MentorApp;
