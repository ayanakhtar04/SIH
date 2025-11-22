import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeRisk } from '../risk/riskUtil';
import { useDarkMode } from '../theme/DarkModeContext';
import { Box, Stack, Typography, Paper, Button, IconButton, Avatar, Chip, Divider, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel, CircularProgress, Snackbar, Alert, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, TableSortLabel, Checkbox, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';
import RiskBadge from '../components/RiskBadge';
import StatCard from '../components/StatCard';
import { useAuth } from '../auth/AuthContext';
import { listPlaybooks, assignPlaybook, addNote, Playbook } from './playbookApi';
import { listStudentMeetings, createMeeting, cancelMeeting, Meeting } from './meetingsApi';
import Student360Dialog from './Student360Dialog';
import ManageStudentsPage from './ManageStudentsPage';
import NotificationModal from './NotificationModal';
import { API } from '../api';
import { assessDropout } from './student360Api';

// Local synthetic calc removed in favor of shared util

interface MentorStudent {
  id: string; name: string; email: string;
  attendance: number; // maps backend attendancePercent
  gpa: number; // maps backend cgpa
  assignmentsSubmitted: number; // legacy local field (assignmentsCompleted)
  assignmentsCompleted?: number; // real backend value
  assignmentsTotal?: number; // real backend value
  lastAcademicUpdate?: string | null; // ISO timestamp from backend
  mentorId?: string | null;
  lastExamScore: number; // placeholder until backend provides exam scores
  performanceHistory: { month: string; score: number }[];
  risk:{ level:string; score:number };
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

const DashboardPage: React.FC<{ token:string; students: MentorStudent[]; onExport: () => void; exporting: boolean; onEdit:(s:MentorStudent)=>void; trendData:any[]; trendLoading:boolean; trendError?:string; currentUserId?:string }> = ({ token, students, onExport, exporting, onEdit, trendData, trendLoading, trendError, currentUserId }) => {
  const highRisk = students.filter(s => s.risk.level === 'High').length;
  const avgAttendance = students.length ? Math.round(students.reduce((acc,s)=> acc+s.attendance,0)/students.length) : 0;
  const interventions7d = students.filter(s => {
    if (!s.lastAcademicUpdate) return false;
    const ts = new Date(s.lastAcademicUpdate).getTime();
    return Date.now() - ts <= 7*24*3600*1000;
  }).length;
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
  const pushToast = (msg:string, sev:'success'|'error'='success') => setToast({ msg, sev });
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
  const [showMeetSection, setShowMeetSection] = useState(true);
  // Upload dialog state is handled at MentorApp level (admin only)
  // Moved to MentorApp; removed from DashboardPage

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
    return b.risk.score - a.risk.score; // risk default
  });
  function handleSort(col: 'risk'|'name'|'attendance') {
    if (sort === col) {
      if (col === 'risk') setSort('name'); else if (col==='name') setSort('attendance'); else setSort('risk');
    } else setSort(col);
  }

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
  // Aggregate risk counts for charts
  const riskCounts = students.reduce((acc:Record<string,number>, s)=> { acc[s.risk.level] = (acc[s.risk.level]||0)+1; return acc; }, {} as Record<string,number>);
  const totalRisk = (riskCounts['High']||0)+(riskCounts['Medium']||0)+(riskCounts['Low']||0);
  const rawDist = [
    { name:'High', value:riskCounts['High']||0 },
    { name:'Medium', value:riskCounts['Medium']||0 },
    { name:'Low', value:riskCounts['Low']||0 }
  ];
  const [showExpanded, setShowExpanded] = React.useState<boolean>(()=> {
    try { const v = localStorage.getItem('mentor.dist.showExpanded'); return v === '1'; } catch { return false; }
  });
  const TINY_THRESHOLD = 0.03; // 3%
  const tiny = rawDist.filter(d=> totalRisk>0 && d.value/totalRisk < TINY_THRESHOLD && d.value>0);
  const nonTiny = rawDist.filter(d=> !tiny.includes(d));
  const otherValue = tiny.reduce((a,b)=> a+b.value, 0);
  const mergedData = otherValue && !showExpanded ? [...nonTiny, { name:'Other', value:otherValue, __other:true, children: tiny }] : rawDist;
  const pieData = mergedData.filter(d=> d.value>0);
  // sort by count descending for display consistency
  const pieDataSorted = [...pieData].sort((a,b)=> b.value - a.value);
  const [distMode, setDistMode] = React.useState<'pie'|'bar'>(()=> {
    try { const v = localStorage.getItem('mentor.dist.mode'); return (v==='bar'||v==='pie') ? v : 'pie'; } catch { return 'pie'; }
  });
  useEffect(()=> { try { localStorage.setItem('mentor.dist.mode', distMode); } catch {} }, [distMode]);
  useEffect(()=> { try { localStorage.setItem('mentor.dist.showExpanded', showExpanded? '1':'0'); } catch {} }, [showExpanded]);
  const COLORS: Record<string,string> = { High:'#c62828', Medium:'#ed6c02', Low:'#2e7d32' };
  // trendData provided by parent

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
      <Box sx={{ display:'grid', gap:3, gridTemplateColumns:{ xs:'1fr', lg:'2fr 1fr' } }}>
        <Paper elevation={0} sx={{ p:2, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3, display:'flex', flexDirection:'column', gap:2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight={600}>Risk Distribution</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button size="small" variant="outlined" onClick={()=> {
                try {
                  const total = pieDataSorted.reduce((a,b)=> a+b.value,0) || 1;
                  const lines = ['Risk,Count,Percent'];
                  pieDataSorted.forEach(d=> { lines.push(`${d.name},${d.value},${((d.value/total)*100).toFixed(2)}%`); });
                  const csv = lines.join('\n');
                  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'risk_distribution.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                  pushToast('Exported distribution CSV');
                } catch { pushToast('Export failed','error'); }
              }}>Export CSV</Button>
              {tiny.length>0 && <Button size="small" variant="text" onClick={()=> { setShowExpanded(s=> !s); pushToast(showExpanded? 'Merged small slices' : 'Expanded all slices'); }} sx={{ textTransform:'none' }}>
                {showExpanded? 'Merge small' : 'Expand all'}
              </Button>}
              <Button size="small" variant="text" onClick={()=> { setDistMode(m=> m==='pie'?'bar':'pie'); pushToast(`Switched to ${distMode==='pie'? 'bar':'pie'} view`); }} sx={{ textTransform:'none' }}>
                {distMode==='pie'? 'Bar' : 'Pie'} view
              </Button>
            </Stack>
          </Stack>
          {distMode==='pie' ? (
            <Box sx={{ height:220, position:'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieDataSorted}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    innerRadius={52}
                    paddingAngle={pieDataSorted.length > 1 ? 3 : 0}
                    isAnimationActive={false}
                  >
                    {pieDataSorted.map((p,i)=> <Cell key={i} fill={COLORS[p.name] || '#607d8b'} stroke="#fff" strokeWidth={1} />)}
                  </Pie>
                  <ReTooltip formatter={(val:any, _n:any, entry:any)=> {
                    const total = pieDataSorted.reduce((a,b)=> a+b.value, 0) || 1;
                    const pct = ((entry.value/total)*100).toFixed(1)+'%';
                    return [`${entry.value} (${pct})`, entry.payload.name];
                  }} />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="#555">
                    {students.length? `${students.length}` : '0'}
                    <tspan x="50%" dy="14" fontSize={11} fill="#777">students</tspan>
                  </text>
                </PieChart>
              </ResponsiveContainer>
              {!students.length && <Box sx={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <Typography variant="caption" color="text.secondary">No risk data</Typography>
              </Box>}
            </Box>
          ) : (
            <Box sx={{ height:220, position:'relative', px:1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pieDataSorted} layout="vertical" margin={{ top:5, right:20, left:30, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} hide domain={[0, Math.max(...pieDataSorted.map(d=> d.value), 1)]} />
                  <YAxis type="category" dataKey="name" width={70} />
                  <ReTooltip formatter={(val:any, _n:any, entry:any)=> {
                    const total = pieDataSorted.reduce((a,b)=> a+b.value, 0) || 1;
                    const pct = ((entry.value/total)*100).toFixed(1)+'%';
                    return [`${entry.value} (${pct})`, entry.payload.name];
                  }} />
                  <Bar dataKey="value" radius={[4,4,4,4]}>
                    {pieDataSorted.map((p,i)=> <Cell key={i} fill={COLORS[p.name] || '#607d8b'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
          <Box sx={{ display:'flex', gap:1, flexWrap:'wrap', mt:1 }}>
            {pieDataSorted.map(item => {
              const total = pieDataSorted.reduce((a,b)=> a+b.value, 0) || 1;
              const pct = ((item.value/total)*100).toFixed(1);
              const isOther = (item as any).__other;
              return (
                <Box key={item.name} sx={{ display:'flex', alignItems:'center', gap:0.75, px:1, py:0.5, borderRadius:2, bgcolor: 'background.paper', border: t=>`1px solid ${t.palette.divider}` }}>
                  <Box sx={{ width:10, height:10, borderRadius:0.5, bgcolor: COLORS[item.name] || '#546e7a' }} />
                  <Typography variant="caption" sx={{ fontWeight:600 }}>{item.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.value} ({pct}%)</Typography>
                  {isOther && !showExpanded && <Typography variant="caption" color="text.secondary">{`(${(item as any).children.length} small)`}</Typography>}
                </Box>
              );
            })}
          </Box>
          <Divider />
          <Typography variant="subtitle1" fontWeight={600}>Risk Trend</Typography>
          <Box sx={{ height:240 }}>
            {trendError && <Typography variant="caption" color="error">{trendError}</Typography>}
            {!trendError && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top:5, right:20, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis allowDecimals={false} />
                  <ReTooltip formatter={(v:any, n:any)=> [v, n]} labelFormatter={(l:string)=> `Date: ${l}`} />
                  <Line type="monotone" dataKey="High" stroke={COLORS.High} strokeWidth={2} />
                  <Line type="monotone" dataKey="Medium" stroke={COLORS.Medium} strokeWidth={2} />
                  <Line type="monotone" dataKey="Low" stroke={COLORS.Low} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {trendLoading && <Typography variant="caption" color="text.secondary">Loading trend...</Typography>}
          </Box>
        </Paper>
        <Paper elevation={0} sx={{ p:2, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3, display:'flex', flexDirection:'column', gap:1.2 }}>
          <Typography variant="subtitle1" fontWeight={600}>Summary</Typography>
          <StatCard title="Assigned Students" value={students.length} icon={<GroupIcon fontSize="small" />} />
          <StatCard title="High-Risk" value={highRisk} change="Needs attention" icon={<WarningRoundedIcon fontSize="small" />} />
          <StatCard title="Avg. Attendance" value={`${avgAttendance}%`} change="Cohort" icon={<CheckCircleOutlineIcon fontSize="small" />} />
          <StatCard title="Interventions (7d)" value={interventions7d} change="last 7 days" icon={<ManageAccountsIcon fontSize="small" />} />
          {/* Chart now uses real backend data if available */}
        </Paper>
      </Box>
      <Paper elevation={0} sx={{ p:1.5, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {selectMode && <TableCell padding="checkbox"><Checkbox size="small" indeterminate={selected.size>0 && selected.size<sorted.length} checked={selected.size>0 && selected.size===sorted.length} onChange={(e)=> {
                  const checked = e.target.checked; setSelected(checked ? new Set(sorted.map(s=> s.id)) : new Set());
                }} /></TableCell>}
                <TableCell sortDirection={sort==='name'? 'asc':false} sx={{ minWidth:180 }}>
                  <TableSortLabel active={sort==='name'} direction={sort==='name'? 'asc':'asc'} onClick={()=> handleSort('name')}>Name</TableSortLabel>
                </TableCell>
                <TableCell>Email / ID</TableCell>
                <TableCell>Indicators</TableCell>
                <TableCell sortDirection={sort==='risk'? 'asc':false}>
                  <TableSortLabel active={sort==='risk'} direction='asc' onClick={()=> handleSort('risk')}>Risk</TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sort==='attendance'? 'asc':false}>
                  <TableSortLabel active={sort==='attendance'} direction='asc' onClick={()=> handleSort('attendance')}>Attendance%</TableSortLabel>
                </TableCell>
                <TableCell>GPA</TableCell>
                <TableCell>Assignments</TableCell>
                <TableCell>Assigned</TableCell>
                <TableCell>Last Contact</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(s => (
                <TableRow key={s.id} hover selected={selected.has(s.id)}>
                  {selectMode && <TableCell padding="checkbox"><Checkbox size="small" checked={selected.has(s.id)} onChange={()=> toggleSelect(s.id)} /></TableCell>}
                  <TableCell sx={{ maxWidth:180 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar sx={{ bgcolor:'primary.main', width:32, height:32 }}>{s.name.charAt(0)}</Avatar>
                      <Box sx={{ minWidth:0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{s.name}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth:260 }}>
                    <Typography variant="caption" color="text.secondary" noWrap>{s.email}</Typography><br />
                    <Typography variant="caption" color="text.secondary" noWrap>{s.id}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {(s.attendance < 75) && <Chip size="small" color="warning" variant="outlined" label="Low Att" />}
                      {(s.gpa < 6) && <Chip size="small" color="warning" variant="outlined" label="Low GPA" />}
                      {(() => { const comp = s.assignmentsCompleted ?? s.assignmentsSubmitted; const tot = s.assignmentsTotal ?? 0; return (tot>0 && comp/Math.max(1,tot) < 0.5); })() && <Chip size="small" color="warning" variant="outlined" label="Low Assign" />}
                      {(!((s.attendance < 75) || (s.gpa < 6) || ((s.assignmentsTotal ?? 0)>0 && (s.assignmentsCompleted ?? s.assignmentsSubmitted)/Math.max(1,(s.assignmentsTotal ?? 0)) < 0.5))) && <Chip size="small" variant="outlined" label="OK" />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <RiskBadge tier={s.risk.level as any} />
                      <Typography variant="caption" color="text.secondary">{(s.risk.score*100).toFixed(0)}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{s.attendance}%</TableCell>
                  <TableCell>{s.gpa.toFixed(1)}</TableCell>
                  <TableCell>
                    {(() => {
                      const comp = s.assignmentsCompleted ?? s.assignmentsSubmitted;
                      const tot = s.assignmentsTotal;
                      if (typeof tot === 'number' && tot > 0) {
                        const pct = Math.round((comp/Math.max(1,tot))*100);
                        return `${comp}/${tot} (${pct}%)`;
                      }
                      return comp;
                    })()}
                  </TableCell>
                  <TableCell>
                    {s.mentorId ? (
                      s.mentorId === currentUserId ? <Chip size="small" label="You" color="info" variant="outlined" /> : <Chip size="small" label="Other" variant="outlined" />
                    ) : <Typography variant="caption" color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const ts = s.lastAcademicUpdate ? new Date(s.lastAcademicUpdate) : null;
                      if (!ts) return <Typography variant="caption" color="text.secondary">—</Typography>;
                      const ageDays = Math.floor((Date.now() - ts.getTime())/86400000);
                      const stale = ageDays > 30;
                      return <Chip size="small" label={ageDays===0? 'Today': ageDays===1? '1d': ageDays+'d'} color={stale? 'warning':'default'} variant={stale? 'filled':'outlined'} />;
                    })()}
                  </TableCell>
                  <TableCell align="right">
                    {!selectMode && <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="outlined" onClick={()=> setQuick(s)}>Quick</Button>
                      <Button size="small" variant="outlined" onClick={()=> { setQuick(s); setShow360(true); }}>View</Button>
                      <Button size="small" variant="text" onClick={()=> onEdit(s)}>Edit</Button>
                    </Stack>}
                    {selectMode && <Button size="small" variant={selected.has(s.id)? 'contained':'outlined'} onClick={()=> toggleSelect(s.id)}>{selected.has(s.id)? '✓':'Select'}</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!sorted.length && (
                <TableRow>
                  <TableCell colSpan={selectMode? 8:7}>
                    <Typography variant="body2" color="text.secondary">No students match filter.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <Dialog open={!!quick} onClose={()=> { if(!saving){ setQuick(null); setNote(''); setPlaybookId(''); } }} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ pb:1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth:0, flex:1 }}>
              {quick && <Avatar sx={{ width:40, height:40, bgcolor:'primary.main' }}>{quick.name.charAt(0)}</Avatar>}
              <Box sx={{ minWidth:0 }}>
                <Typography variant="subtitle1" fontWeight={700} noWrap>Quick Action{quick? `: ${quick.name}`:''}</Typography>
                {quick && <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt:0.25 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <RiskBadge tier={quick.risk.level as any} />
                    <Typography variant="caption" color="text.secondary">{(quick.risk.score*100).toFixed(0)}</Typography>
                  </Stack>
                  <Chip size="small" label={`Att ${quick.attendance}%`} />
                  <Chip size="small" label={`GPA ${quick.gpa.toFixed(1)}`} />
                  <Chip size="small" label={`Assign ${quick.assignmentsSubmitted}`} />
                </Stack>}
              </Box>
            </Stack>
            {quick && <Button size="small" onClick={()=> setShow360(true)} variant="outlined">360°</Button>}
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, maxHeight:'65vh', overflowY:'auto', pt:0 }}>
          <Typography variant="body2" color="text.secondary">Assign a playbook and/or add a note for this student.</Typography>
          <TextField label="Note" value={note} onChange={e=> setNote(e.target.value)} placeholder="Observation / planned intervention" multiline minRows={3} fullWidth disabled={saving} autoFocus onKeyDown={(e)=> { if(e.ctrlKey && e.key==='Enter' && !saving && (playbookId || note.trim())) { handleSaveQuick(); } }} />
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
          <Accordion disableGutters elevation={0} expanded={showMeetSection} onChange={()=> setShowMeetSection(s=> !s)} sx={{ bgcolor:'transparent', border:'1px solid', borderColor: t=> t.palette.divider, borderRadius:2, '&:before':{ display:'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Schedule Meeting</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack direction={{ xs:'column', sm:'row' }} spacing={1} mb={1.2}>
                <TextField label="Title" value={mtTitle} onChange={e=> setMtTitle(e.target.value)} fullWidth size="small" disabled={saving} />
                <TextField label="Date" type="date" value={mtDate} onChange={e=> setMtDate(e.target.value)} InputLabelProps={{ shrink:true }} size="small" disabled={saving} />
                <TextField label="Start" type="time" value={mtStart} onChange={e=> setMtStart(e.target.value)} InputLabelProps={{ shrink:true }} size="small" disabled={saving} />
                <TextField label="Duration" type="number" value={mtDuration} onChange={e=> setMtDuration(Math.max(5,Math.min(480, Number(e.target.value)||30)))} size="small" disabled={saving} sx={{ maxWidth:120 }} />
              </Stack>
              <Stack direction={{ xs:'column', sm:'row' }} spacing={1} mb={1.2}>
                <TextField label="Location" value={mtLocation} onChange={e=> setMtLocation(e.target.value)} fullWidth size="small" disabled={saving} />
                <TextField label="Notes" value={mtNotes} onChange={e=> setMtNotes(e.target.value)} fullWidth size="small" disabled={saving} />
              </Stack>
              <Button size="small" variant="outlined" onClick={handleSchedule} disabled={saving || !mtTitle || !mtDate || !mtStart} sx={{ mb:1 }}>Schedule</Button>
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
            </AccordionDetails>
          </Accordion>
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
  {/* Global notify modal opened from Student360 via window event */}
  <NotificationModal open={(window as any).__pkGlobalNotify?.open || false} onClose={()=> { (window as any).__pkGlobalNotify = { open:false }; }} token={token} studentIds={(window as any).__pkGlobalNotify?.studentIds} presetBody={(window as any).__pkGlobalNotify?.presetBody} />
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
      <Snackbar open={!!toast} autoHideDuration={3200} onClose={()=> setToast(null)} anchorOrigin={{ vertical:'bottom', horizontal:'center' }}>
        <Alert severity={toast?.sev || 'success'} onClose={()=> setToast(null)} variant="filled">{toast?.msg}</Alert>
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
  // Admin CSV upload dialog state (used by sidebar button and dialog)
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File|null>(null);
  const decoded = useMemo(()=> { try { if (!session?.token) return undefined as any; const p = JSON.parse(atob(session.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); return p; } catch { return undefined as any; } }, [session]);
  const decodedRole = decoded?.role || decoded?.user?.role;
  const decodedId = decoded?.id || decoded?.user?.id;

  const allowed = ['mentor','teacher','counselor','admin'];
  if (!session) return <Box p={4}><Typography>Not authenticated</Typography></Box>;
  if (!decodedRole || !allowed.includes(decodedRole)) return <Box p={4}><Typography variant="h5" fontWeight={700}>Forbidden</Typography><Typography variant="body2" color="text.secondary">Mentor or counselor role required.</Typography></Box>;

  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [onlyMine, setOnlyMine] = useState<boolean>(false);
  const synthPerformance = (base:number) => [ 'Jan','Feb','Mar','Apr','May','Jun' ].map((m,i)=> ({ month:m, score: Math.max(40, Math.min(100, base + Math.sin(i+1)*8 - i*2)) }));

  // Real risk trend fetched from backend snapshots endpoint
  const [trendData, setTrendData] = useState<any[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string|undefined>();
  const fetchTrend = useCallback(async (tok?:string) => {
    const t = tok || session?.token;
    if (!t) return;
    setTrendLoading(true); setTrendError(undefined);
    try {
      const r = await fetch('/api/students/risk-trend?days=30', { headers:{ Authorization:`Bearer ${t}` }});
      if(!r.ok) throw new Error(`Trend failed (${r.status})`);
      const j = await r.json();
      if(!j.ok) throw new Error(j.error || 'Trend failed');
      const mapped = (j.trend || []).map((d:any)=> ({
        period: (d.date || d.period || '').toString().slice(5) || (d.period ?? ''),
        High: d.highCount ?? d.high ?? 0,
        Medium: d.mediumCount ?? d.medium ?? 0,
        Low: d.lowCount ?? d.low ?? 0,
        avgRisk: d.avgRisk ?? null
      }));
      setTrendData(mapped);
    } catch(e:any) {
      setTrendError(e.message || 'Failed loading risk trend');
    } finally { setTrendLoading(false); }
  }, [session?.token]);

  useEffect(()=> { fetchTrend(); }, [fetchTrend]);

  const fetchStudents = useCallback(()=> {
    if (!session?.token) return;
    setLoading(true); setErr(undefined);
    const params = new URLSearchParams({ page:'1', pageSize:'200' });
    if (query.trim()) params.set('search', query.trim());
    // server-side mentor scoping already applied; admin can toggle to onlyMine by filtering client-side
    fetch(`${API.students}?${params.toString()}`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r=> { if(!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then(json => {
        let raw = json.data || json.students || [];
        // client-side filters for program/year
        if (deptFilter !== 'All') raw = raw.filter((s:any)=> (s.program||'').toLowerCase().includes(deptFilter.toLowerCase()));
        if (yearFilter !== 'All') raw = raw.filter((s:any)=> String(s.year||'') === yearFilter);
        if (onlyMine && decodedRole==='admin' && decodedId) raw = raw.filter((s:any)=> s.mentorId === decodedId);
  const mapped: MentorStudent[] = raw.map((s:any,i:number)=> {
          const attendance = typeof s.attendancePercent === 'number' ? s.attendancePercent : 0;
          const gpa = typeof s.cgpa === 'number' ? s.cgpa : 0;
          const assignmentsCompleted = typeof s.assignmentsCompleted === 'number' ? s.assignmentsCompleted : 0;
          const assignmentsTotal = typeof s.assignmentsTotal === 'number' ? s.assignmentsTotal : 0;
          const assignmentsSubmitted = assignmentsCompleted; // legacy naming in UI
          const lastExamScore = 0; // not provided by backend yet
          const norm = normalizeRisk({ backendScore: s.riskScore, backendTier: s.riskTier, fallbackMetrics: { attendance, gpa, assignmentsSubmitted } });
          return {
            id: s.id || `mstu-${i}`,
            name: s.name || `Student ${i+1}`,
            email: s.email || `student${i+1}@example.com`,
            attendance,
            gpa,
            assignmentsSubmitted,
            lastAcademicUpdate: s.lastAcademicUpdate || null,
            lastExamScore,
            performanceHistory: synthPerformance(60 + ((i*5)%30)),
            risk: { level: norm.level, score: norm.score ?? 0 },
            // extra raw metrics for future inline editing
            // @ts-ignore
            assignmentsTotal,
            // @ts-ignore
            assignmentsCompleted,
            mentorId: s.mentorId ?? null
          } as MentorStudent & { assignmentsTotal:number; assignmentsCompleted:number };
        });
  setStudents(mapped);
      })
      .catch(e=> setErr(e.message))
      .finally(()=> setLoading(false));
  }, [session]);

  useEffect(()=> { fetchStudents(); }, [fetchStudents]);
  // Refresh when any student is claimed/assigned/edited elsewhere in app
  useEffect(()=> {
    const handler = () => { fetchStudents(); fetchTrend(); };
    const noteHandler = (e:any) => {
      const detail = e?.detail || {}; if (!detail.studentId || !detail.note || !session?.token) return;
      addNote(session.token, { studentId: detail.studentId, note: detail.note }).then(()=> {
        // lightweight feedback using browser alert to avoid crossing child component state
        try { (window as any).pkToast?.('Intervention logged'); } catch {}
  window.dispatchEvent(new CustomEvent('pk:students-updated'));
  try { localStorage.setItem('pk:last-students-update', String(Date.now())); } catch {}
      }).catch((err:any)=> {
        try { (window as any).pkToast?.(err.message||'Log failed','error'); } catch {}
      });
    };
    const notifyHandler = (e:any) => {
      const detail = e?.detail || {};
      (window as any).__pkGlobalNotify = { open:true, studentIds: detail.studentIds, presetBody: detail.presetBody, singleStudentName: detail.singleStudentName };
      // Force a small state tick by toggling sidebar to refresh render of modal
      setSidebarOpen(v=> v);
    };
    window.addEventListener('pk:students-updated', handler as any);
    window.addEventListener('pk:student-log-note', noteHandler as any);
    window.addEventListener('pk:notify', notifyHandler as any);
  return () => { window.removeEventListener('pk:students-updated', handler as any); window.removeEventListener('pk:student-log-note', noteHandler as any); window.removeEventListener('pk:notify', notifyHandler as any); };
  }, [fetchStudents, fetchTrend]);

  function buildCsv(rows: MentorStudent[]): string {
  const header = ['id','name','email','attendancePercent','cgpa','assignmentsCompleted','assignmentsTotal','riskLevel','riskScore'];
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
        // @ts-ignore legacy mapping includes added fields
        (r as any).assignmentsCompleted ?? r.assignmentsSubmitted,
        // @ts-ignore
        (r as any).assignmentsTotal ?? '',
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

  // Academic edit state at app level
  const [editTarget, setEditTarget] = useState<MentorStudent | null>(null);
  const [editAttendance, setEditAttendance] = useState('');
  const [editCgpa, setEditCgpa] = useState('');
  const [editAssignCompleted, setEditAssignCompleted] = useState('');
  const [editAssignTotal, setEditAssignTotal] = useState('');
  const [editFeesCategory, setEditFeesCategory] = useState<'paid'|'unpaid'>('paid');
  const [editBehaviorCategory, setEditBehaviorCategory] = useState<'friendly'|'introvert'|'extrovert'|'aggressive'|'withdrawn'|'other'>('friendly');
  const [editMotivationLevel, setEditMotivationLevel] = useState<'low'|'medium'|'high'>('medium');
  const [editSaving, setEditSaving] = useState(false);
  const handleOpenEdit = (s: MentorStudent) => {
    setEditTarget(s);
    setEditAttendance(String(s.attendance ?? ''));
    setEditCgpa(String(s.gpa ?? ''));
    setEditAssignCompleted(String(s.assignmentsCompleted ?? s.assignmentsSubmitted ?? ''));
    setEditAssignTotal(String(s.assignmentsTotal ?? ''));
  setEditFeesCategory('paid');
  setEditBehaviorCategory('friendly');
  setEditMotivationLevel('medium');
  };
  const handleCloseEdit = () => { if(!editSaving) setEditTarget(null); };
  const handleSaveEdit = async () => {
    if (!editTarget || !session?.token) return;
    const payload:any = {};
    const a = Number(editAttendance); if(!Number.isNaN(a) && a>=0 && a<=100) payload.attendancePercent = a;
    const g = Number(editCgpa); if(!Number.isNaN(g) && g>=0 && g<=10) payload.cgpa = g;
    const ac = Number(editAssignCompleted); if(!Number.isNaN(ac) && ac>=0) payload.assignmentsCompleted = ac;
    const at = Number(editAssignTotal); if(!Number.isNaN(at) && at>=0) payload.assignmentsTotal = at;
    if(Object.keys(payload).length===0){ handleCloseEdit(); return; }
    setEditSaving(true);
    try {
      const r = await fetch(`${API.students}/${editTarget.id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.token}` }, body: JSON.stringify(payload) });
      if(!r.ok) throw new Error('Update failed');
      const js = await r.json();
      if(!js.ok) throw new Error(js.error || 'Update failed');
      setStudents(sts => sts.map(s=> s.id===editTarget.id ? { ...s,
        attendance: payload.attendancePercent ?? s.attendance,
        gpa: payload.cgpa ?? s.gpa,
        assignmentsSubmitted: payload.assignmentsCompleted ?? s.assignmentsSubmitted,
        assignmentsCompleted: payload.assignmentsCompleted ?? s.assignmentsCompleted,
        assignmentsTotal: payload.assignmentsTotal ?? s.assignmentsTotal,
        risk:{ level: (js.student.riskTier || '').toString().toLowerCase()==='high'? 'High' : (js.student.riskTier || '').toString().toLowerCase()==='medium'? 'Medium' : (js.student.riskTier || '').toString().toLowerCase()==='low'? 'Low' : 'Unknown',
               score: js.student.riskScore }
      }: s));
      // Broadcast updates so student dashboards refresh immediately
      try {
        window.dispatchEvent(new CustomEvent('pk:students-updated'));
        localStorage.setItem('pk:last-students-update', String(Date.now()));
      } catch {}
      setEditTarget(null);
    } catch(e){ /* optionally handle error */ }
    finally { setEditSaving(false); }
  };

  const handleSaveEditWithAssess = async () => {
    if (!editTarget || !session?.token) return;
    setEditSaving(true);
    try {
      // First persist academic updates (if any)
      const payload:any = {};
      const att = Number(editAttendance); if(!Number.isNaN(att) && att>=0) payload.attendancePercent = att;
      const cg = Number(editCgpa); if(!Number.isNaN(cg) && cg>=0) payload.cgpa = cg;
      const ac = Number(editAssignCompleted); if(!Number.isNaN(ac) && ac>=0) payload.assignmentsCompleted = ac;
      const at = Number(editAssignTotal); if(!Number.isNaN(at) && at>=0) payload.assignmentsTotal = at;
      if (Object.keys(payload).length) {
        const r = await fetch(`${API.students}/${editTarget.id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.token}` }, body: JSON.stringify(payload) });
        const j = await r.json().catch(()=>({ ok:false }));
        if(!r.ok || j.ok===false) throw new Error(j.error || `HTTP ${r.status}`);
        const st = j.student;
        setStudents(sts => sts.map(s=> s.id===editTarget.id ? { ...s,
          attendance: payload.attendancePercent ?? s.attendance,
          gpa: payload.cgpa ?? s.gpa,
          assignmentsCompleted: payload.assignmentsCompleted ?? s.assignmentsCompleted,
          assignmentsTotal: payload.assignmentsTotal ?? s.assignmentsTotal,
          risk: { level: st.riskTier?.charAt(0).toUpperCase() + st.riskTier?.slice(1) || s.risk.level, score: typeof st.riskScore==='number'? st.riskScore: s.risk.score }
        }: s));
      }
      // Then call dropout assessment with 5 parameters
      const resp = await assessDropout(session.token, editTarget.id, {
        cgpa: Number.isNaN(Number(editCgpa)) ? undefined : Number(editCgpa),
        attendancePercent: Number.isNaN(Number(editAttendance)) ? undefined : Number(editAttendance),
        fees: editFeesCategory === 'paid' ? 'clear' : 'due',
        behavior: ({ friendly:8, extrovert:7, introvert:6, aggressive:3, withdrawn:2, other:5 } as any)[editBehaviorCategory] ?? 5,
        motivation: ({ low:3, medium:6, high:9 } as any)[editMotivationLevel]
      });
  setStudents(sts => sts.map(s=> s.id===editTarget.id ? { ...s, risk: { level: resp.student.riskTier?.charAt(0).toUpperCase() + resp.student.riskTier?.slice(1), score: resp.student.riskScore } }: s));
  // Signal refresh for student dashboards (self 360 and /auth/student/me consumers)
  try { window.dispatchEvent(new CustomEvent('pk:students-updated')); localStorage.setItem('pk:last-students-update', String(Date.now())); } catch {}
      setEditTarget(null);
    } catch(e:any) {
      alert(e.message || 'Save failed');
    } finally { setEditSaving(false); }
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
  return <DashboardPage token={session.token} students={students} onExport={handleExport} exporting={exporting} onEdit={handleOpenEdit} trendData={trendData} trendLoading={trendLoading} trendError={trendError} currentUserId={decodedId} />;
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

  // compute last data sync (max lastAcademicUpdate across list)
  const lastSync = useMemo(()=> {
    const ts = students.map(s=> s.lastAcademicUpdate ? new Date(s.lastAcademicUpdate).getTime() : 0).reduce((a,b)=> Math.max(a,b), 0);
    return ts ? new Date(ts).toLocaleString() : '—';
  }, [students]);

  // expose a simple toast bridge
  useEffect(()=> { (window as any).pkToast = (msg:string)=> { /* no-op bridge; Snackbar inside DashboardPage handles most toasts */ console.info(msg); }; return ()=> { try { delete (window as any).pkToast; } catch {} } }, []);

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
          {decodedRole==='admin' && <Button size="small" variant="outlined" onClick={()=> setUploadOpen(true)} sx={{ mt:1 }}>Upload Data</Button>}
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
          <Box sx={{ flex:1, maxWidth: sidebarOpen? 460: 360, position:'relative', display:'flex', gap:1 }}>
            <SearchIcon fontSize="small" style={{ position:'absolute', top:8, left:8, opacity:0.55 }} />
            <input value={query} onChange={e=> setQuery(e.target.value)} onKeyDown={e=> { if(e.key==='Enter') fetchStudents(); }} placeholder="Search by name or ID..." style={{ width:'50%', padding:'8px 10px 8px 30px', borderRadius:8, outline:'none', border:'1px solid rgba(0,0,0,0.2)', background:'transparent', color:'inherit' }} />
            <select value={deptFilter} onChange={e=> setDeptFilter(e.target.value)} style={{ padding:'8px 10px', borderRadius:8, border:'1px solid rgba(0,0,0,0.2)', background:'transparent', color:'inherit' }}>
              <option value="All">All Departments</option>
              <option value="CSE">CSE</option>
              <option value="ECE">ECE</option>
              <option value="ME">ME</option>
            </select>
            <select value={yearFilter} onChange={e=> setYearFilter(e.target.value)} style={{ padding:'8px 10px', borderRadius:8, border:'1px solid rgba(0,0,0,0.2)', background:'transparent', color:'inherit' }}>
              <option value="All">All Years</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
            {decodedRole==='admin' && (
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                <input type="checkbox" checked={onlyMine} onChange={e=> setOnlyMine(e.target.checked)} /> Only my students
              </label>
            )}
            <Button size="small" variant="outlined" onClick={()=> fetchStudents()}>Search</Button>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton size="small"><ChatBubbleOutlineIcon fontSize="small" /></IconButton>
      <Stack direction="row" spacing={1} alignItems="center">
              <Avatar sx={{ width:40, height:40, bgcolor:'primary.main' }}>{decodedRole?.charAt(0).toUpperCase() || 'M'}</Avatar>
              <Box sx={{ display:{ xs:'none', sm:'block' } }}>
                <Typography variant="subtitle2" fontWeight={600} noWrap>{decodedRole || 'Mentor'}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>Last data sync: {lastSync}</Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ flex:1, p:{ xs:2, md:3 }, display:'flex', flexDirection:'column', gap:3, overflowY:'auto' }}>
          {loading && <Typography variant="body2">Loading students...</Typography>}
          {err && <Typography variant="body2" color="error">{err}</Typography>}
          {!loading && !err && page==='dashboard' && students.length===0 && (
            <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>No Students Found</Typography>
              <Typography variant="body2" color="text.secondary">You currently have no assigned students. This view now also includes unassigned students, but none are available.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt:1 }}>Next steps:</Typography>
              <ul style={{ marginTop:4, marginBottom:0, paddingLeft:18 }}>
                <li><Typography variant="body2" color="text.secondary">Ask an administrator to import or create students.</Typography></li>
                <li><Typography variant="body2" color="text.secondary">Have an admin assign students to you (mentor) via the admin dashboard.</Typography></li>
                <li><Typography variant="body2" color="text.secondary">Refresh after assignment to see risk badges and trends.</Typography></li>
              </ul>
            </Paper>
          )}
          {renderPage()}
          <Dialog open={!!editTarget} onClose={handleCloseEdit} fullWidth maxWidth="xs">
            <DialogTitle>Edit Academic Metrics</DialogTitle>
            <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:1 }}>
              <TextField label="Attendance %" value={editAttendance} onChange={e=> setEditAttendance(e.target.value)} type="number" inputProps={{ min:0, max:100 }} size="small" disabled={editSaving} />
              <TextField label="CGPA" value={editCgpa} onChange={e=> setEditCgpa(e.target.value)} type="number" inputProps={{ step:'0.1', min:0, max:10 }} size="small" disabled={editSaving} />
              <Stack direction={{ xs:'column', sm:'row' }} spacing={1}>
                <TextField label="Assignments Completed" value={editAssignCompleted} onChange={e=> setEditAssignCompleted(e.target.value)} type="number" inputProps={{ min:0 }} size="small" disabled={editSaving} fullWidth />
                <TextField label="Assignments Total" value={editAssignTotal} onChange={e=> setEditAssignTotal(e.target.value)} type="number" inputProps={{ min:0 }} size="small" disabled={editSaving} fullWidth />
              </Stack>
              {/* Mentor dropout assessment parameters */}
              <Divider />
              <Typography variant="subtitle2">Mentor Dropout Assessment</Typography>
              <Stack direction={{ xs:'column', sm:'row' }} spacing={1}>
                <TextField select size="small" label="Fees" value={editFeesCategory} onChange={e=> setEditFeesCategory(e.target.value as any)} disabled={editSaving} fullWidth>
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="unpaid">Unpaid</MenuItem>
                </TextField>
                <TextField select size="small" label="Behaviour" value={editBehaviorCategory} onChange={e=> setEditBehaviorCategory(e.target.value as any)} disabled={editSaving} fullWidth>
                  <MenuItem value="friendly">Friendly</MenuItem>
                  <MenuItem value="introvert">Introvert</MenuItem>
                  <MenuItem value="extrovert">Extrovert</MenuItem>
                  <MenuItem value="aggressive">Aggressive</MenuItem>
                  <MenuItem value="withdrawn">Withdrawn</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
                <TextField select size="small" label="Motivation" value={editMotivationLevel} onChange={e=> setEditMotivationLevel(e.target.value as any)} disabled={editSaving} fullWidth>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </TextField>
              </Stack>
              <Typography variant="caption" color="text.secondary">Leave fields blank to keep existing values.</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseEdit} disabled={editSaving}>Cancel</Button>
              <Button onClick={handleSaveEditWithAssess} variant="contained" disabled={editSaving}>{editSaving? 'Saving...':'Save'}</Button>
            </DialogActions>
          </Dialog>
          <Dialog open={uploadOpen} onClose={()=> !uploading && setUploadOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Upload Data (CSV)</DialogTitle>
            <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2 }}>
              <Typography variant="body2" color="text.secondary">Upload students CSV (supports academic columns). This replaces or adds records. Use dry-run on first try.</Typography>
              <input type="file" accept=".csv,text/csv" onChange={e=> setUploadFile(e.target.files?.[0] || null)} disabled={uploading} />
              <Typography variant="caption" color="text.secondary">Tip: Start with Import Template from Admin tools if unsure.</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={()=> setUploadOpen(false)} disabled={uploading}>Cancel</Button>
              <Button variant="contained" disabled={!uploadFile || uploading} onClick={async ()=> {
                if (!uploadFile || !session?.token) return;
                setUploading(true);
                try {
                  const form = new FormData(); form.append('file', uploadFile);
                  const resp = await fetch('/api/students/import?dryRun=false', { method:'POST', headers:{ Authorization:`Bearer ${session.token}` }, body: form });
                  const js = await resp.json().catch(()=>({ ok:false }));
                  if (!resp.ok || js.ok===false) throw new Error(js.error || `HTTP ${resp.status}`);
                  setUploadOpen(false); setUploadFile(null);
                  window.dispatchEvent(new CustomEvent('pk:students-updated'));
                  try { localStorage.setItem('pk:last-students-update', String(Date.now())); } catch {}
                  try { (window as any).pkToast?.('Upload successful'); } catch { alert('Upload successful'); }
                } catch(e:any) { try { (window as any).pkToast?.(e.message || 'Upload failed','error'); } catch { alert(e.message || 'Upload failed'); } }
                finally { setUploading(false); }
              }}>{uploading? 'Uploading...':'Upload'}</Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Box>
    </Box>
  );
};

const NavBtn: React.FC<{ active:boolean; icon:React.ReactNode; label:string; onClick:()=>void; open:boolean; }> = ({ active, icon, label, onClick, open }) => (
  <Button onClick={onClick} startIcon={open? icon: undefined} size="small" variant={active? 'contained':'text'} fullWidth sx={{ justifyContent: open? 'flex-start':'center', fontWeight:600, borderRadius:2, minHeight:38 }}>{open? label: (active? icon: icon)}</Button>
);

export default MentorApp;
