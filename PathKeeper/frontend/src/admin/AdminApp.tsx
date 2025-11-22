import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { normalizeRisk } from '../risk/riskUtil';
import { useDarkMode } from '../theme/DarkModeContext';
import { Box, Button, Chip, Divider, IconButton, Avatar, Typography, Stack, Paper, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, CircularProgress, Snackbar, Alert, Skeleton, LinearProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import StatCard from '../components/StatCard';
import { fetchOverview, fetchRiskTrend, fetchEffectiveness, OverviewMetrics, RiskTrendPoint, EffectivenessMetrics } from './analyticsApi';
import { TOKENS } from '../components/DesignTokens';
import RiskBadge from '../components/RiskBadge';
import { listUsers, createUser, deleteUser, resetUserPassword, AdminUser } from './userApi';
import { fetchAuditLogs, AuditLogEntry } from './auditApi';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import AddIcon from '@mui/icons-material/Add';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SearchIcon from '@mui/icons-material/Search';
import { useAuth } from '../auth/AuthContext';
import { API, API_BASE } from '../api';
import { fetchRiskConfig, saveRiskConfig } from './riskConfigApi';
import ApiStatus from '../components/ApiStatus';
import PageTransition from '../components/PageTransition';
import StudentProfileDrawer from './StudentProfileDrawer';
// Inline admin pages (reuse existing generic pages so redirect logic does not force user out of /admin)
import Notifications from '../pages/Notifications';
import StudentImport from '../pages/StudentImport';

// Local risk calculation removed; now using shared util with backend riskScore fallback

interface AdminStudent {
  id: string; name: string; email: string; attendance: number; gpa: number; assignmentsSubmitted: number; lastExamScore: number; risk: { level: string; score: number };
}

// Placeholder mentor data (could be replaced by real endpoint later)
interface Mentor { id: string; name: string; email: string; role: string; studentsAssigned: number; }

const placeholderMentors: Mentor[] = [
  { id: 'm1', name: 'Mentor One', email: 'mentor1@example.com', role: 'Counselor', studentsAssigned: 4 },
  { id: 'm2', name: 'Mentor Two', email: 'mentor2@example.com', role: 'Mentor', studentsAssigned: 3 },
  { id: 'm3', name: 'Mentor Three', email: 'mentor3@example.com', role: 'Mentor', studentsAssigned: 0 },
];

// --- Small reusable components ---

// Replaced inline RiskBadge with shared component

// --- Pages ---
const DashboardPage: React.FC<{ students: AdminStudent[]; mentors: Mentor[]; onExport: ()=>void; exporting: boolean; token?: string }> = ({ students, mentors, onExport, exporting, token }) => {
  const highRiskCount = students.filter(s => s.risk.level === 'High').length;
  const riskCounts = students.reduce((acc: Record<string, number>, s) => { acc[s.risk.level] = (acc[s.risk.level] || 0) + 1; return acc; }, {} as Record<string, number>);
  const data = [
    { name: 'High Risk', value: riskCounts['High'] || 0 },
    { name: 'Medium Risk', value: riskCounts['Medium'] || 0 },
    { name: 'Low Risk', value: riskCounts['Low'] || 0 }
  ];
  // Build a synthetic risk trend over last 6 periods (could map to months). Aggregate counts per tier.
  const trendBase = ['Jan','Feb','Mar','Apr','May','Jun'];
  const trend = trendBase.map((label, i) => {
    // simple smoothing: reuse current distribution but vary slightly
    const factor = (i+1)/trendBase.length;
    return {
      period: label,
      High: Math.round((riskCounts['High'] || 0) * (0.6 + factor*0.4) / (1 + i*0.05)),
      Medium: Math.round((riskCounts['Medium'] || 0) * (0.7 + factor*0.3) / (1 + i*0.03)),
      Low: Math.round((riskCounts['Low'] || 0) * (0.8 + factor*0.2) / (1 + i*0.02))
    };
  });
  const COLORS: Record<string,string> = { 'High Risk': TOKENS.risk.colors.High.light, 'Medium Risk': TOKENS.risk.colors.Medium.light, 'Low Risk': TOKENS.risk.colors.Low.light };
  // Live metrics state
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics | null>(null);
  const [trendMetrics, setTrendMetrics] = useState<RiskTrendPoint[] | null>(null);
  const [effMetrics, setEffMetrics] = useState<EffectivenessMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  useEffect(()=> {
    if (!token) return;
    setMetricsLoading(true);
    Promise.all([fetchOverview(token), fetchRiskTrend(token, 30), fetchEffectiveness(token)])
      .then(([o,t,e])=> { setOverviewMetrics(o); setTrendMetrics(t); setEffMetrics(e); })
      .catch(()=> {})
      .finally(()=> setMetricsLoading(false));
  }, [token]);
  return (
    <Stack spacing={4}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
        <Typography variant="h4" fontWeight={700}>Admin Dashboard</Typography>
        <Button variant="contained" startIcon={<AddIcon />} disabled={exporting} onClick={onExport}>{exporting? 'Exporting...':'Generate Report'}</Button>
      </Stack>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', lg: 'repeat(4,1fr)' } }}>
        <StatCard title="Students" value={overviewMetrics? overviewMetrics.studentsTotal : students.length} change="Live" icon={<GroupIcon fontSize="small" />} />
        <StatCard title="High Risk" value={overviewMetrics? overviewMetrics.highRisk : highRiskCount} change={overviewMetrics? `${((overviewMetrics.highRisk/(overviewMetrics.studentsTotal||1))*100).toFixed(0)}%` : ''} icon={<WarningRoundedIcon fontSize="small" />} />
        <StatCard title="Active Assignments" value={overviewMetrics? overviewMetrics.playbookAssignmentsActive : 0} change="" icon={<SpaceDashboardIcon fontSize="small" />} />
        <StatCard title="Upcoming Meetings" value={overviewMetrics? overviewMetrics.meetingsUpcoming : 0} change="7d" icon={<SpaceDashboardIcon fontSize="small" />} />
      </Box>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', xl: '2fr 1fr' } }}>
        <Paper elevation={0} sx={{ p: 3, border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 3, display:'flex', flexDirection:'column', gap:3 }}>
          <Box>
            <Typography variant="h6" fontWeight={700} mb={2}>Risk Distribution</Typography>
            <Box sx={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} outerRadius={90} dataKey="value" nameKey="name" label={(e:any)=> `${e.name} ${(e.percent*100).toFixed(0)}%` }>
                    {data.map((d,i)=> <Cell key={i} fill={COLORS[d.name]} />)}
                  </Pie>
                  <ReTooltip wrapperStyle={{ zIndex: 9999 }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h6" fontWeight={700} mb={2}>Risk Trend {metricsLoading && '(loading...)'}</Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendMetrics && trendMetrics.length ? trendMetrics.map(p=> ({ period:p.date.slice(5), High:p.highCount, Medium:p.mediumCount, Low:p.lowCount })) : trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis allowDecimals={false} />
                  <ReTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="High" stroke={TOKENS.risk.colors.High.light} strokeWidth={2} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Medium" stroke={TOKENS.risk.colors.Medium.light} strokeWidth={2} />
                  <Line type="monotone" dataKey="Low" stroke={TOKENS.risk.colors.Low.light} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </Paper>
        <Paper elevation={0} sx={{ p: 3, border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 3, display:'flex', flexDirection:'column', gap:2 }}>
          <Typography variant="h6" fontWeight={700}>Intervention Effectiveness</Typography>
          {metricsLoading && <Typography variant="caption" color="text.secondary">Loading effectiveness…</Typography>}
          {effMetrics && (
            <Stack spacing={1}>
              <Typography variant="body2">Assignments: {effMetrics.totals.completed}/{effMetrics.totals.total} completed ({(effMetrics.completionRate*100).toFixed(0)}%)</Typography>
              <Typography variant="body2">Avg Completion Time: {effMetrics.avgCompletionDays != null ? effMetrics.avgCompletionDays.toFixed(1)+'d':'—'}</Typography>
              <Typography variant="body2">Meeting Completion Rate: {(effMetrics.meetingCompletionRate*100).toFixed(0)}%</Typography>
              <Box sx={{ display:'flex', gap:1 }}>
                {(['completed','inProgress','assigned'] as const).map(k=> {
                  const v = (effMetrics as any).totals[k];
                  const pct = effMetrics.totals.total? (v/effMetrics.totals.total)*100 : 0;
                  return <Box key={k} sx={{ flex:1, bgcolor:'action.hover', p:0.5, borderRadius:1 }}><Typography variant="caption" fontWeight={600}>{k}</Typography><Typography variant="caption" display="block">{v} ({pct.toFixed(0)}%)</Typography></Box>;
                })}
              </Box>
            </Stack>
          )}
        </Paper>
      </Box>
    </Stack>
  );
};

// Distinct Overview page focusing on quick triage & recent system activity
const OverviewPage: React.FC<{ students: AdminStudent[]; auditToken: string | undefined; onExport: ()=>void; exporting: boolean; onOpenStudent: (id:string)=>void; }> = ({ students, auditToken, onExport, exporting, onOpenStudent }) => {
  const highRisk = students.filter(s => s.risk.level === 'High').slice(0,5);
  const mediumRisk = students.filter(s => s.risk.level === 'Medium').slice(0,5);
  // Synthetic trend generator for mini sparklines
  const buildTrend = (tier: string) => {
    const base = students.filter(s=> s.risk.level===tier).length || 1;
    const arr: number[] = [];
    for (let i=7;i>=0;i--) {
      const offset = tier==='High'? 0.15 : tier==='Medium'? 0.05 : -0.03;
      const wave = Math.sin((i+1)*1.25 + base*0.1) * 0.18 + offset;
      arr.push(Math.max(0, base + Math.round(base * wave * 0.4)));
    }
    return arr;
  };
  const trendHigh = buildTrend('High');
  const trendMedium = buildTrend('Medium');
  const trendLow = buildTrend('Low');
  const Sparkline: React.FC<{ data:number[]; color:string; }> = ({ data, color }) => {
    if (!data.length) return null;
    const max = Math.max(...data) || 1;
    const w = 74; const h = 26; const step = w / (data.length - 1);
    const path = data.map((v,i)=> `${i===0?'M':'L'}${(i*step).toFixed(1)},${(h - (v/max)*h).toFixed(1)}`).join(' ');
    const fillPoints = data.map((v,i)=> `${(i*step).toFixed(1)},${(h - (v/max)*h).toFixed(1)}`).join(' ');
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display:'block', overflow:'visible' }}>
        <polyline points={fillPoints + ` ${w},${h} 0,${h}`} fill={color + '22'} stroke="none" />
        <path d={path} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      </svg>
    );
  };
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  // Quick Action UI state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name:'', email:'' });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthResult, setHealthResult] = useState<string | null>(null);
  // Toast notification state (fixed generic syntax)
  const [toast, setToast] = useState<{ msg:string; sev:'success'|'error'|'info'; } | null>(null);
  useEffect(() => {
    if (!auditToken) return;
    setLogsLoading(true);
    fetch(`${API_BASE.replace(/\/$/, '')}/audit?page=1&pageSize=10`, { headers: { Authorization: `Bearer ${auditToken}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Audit fetch failed')))
      .then(j => setLogs(j.logs || []))
      .catch(()=>{})
      .finally(()=> setLogsLoading(false));
  }, [auditToken]);
  const handleInvite = async () => {
    if (!auditToken) return;
    setInviteSubmitting(true);
    try {
      const res = await fetch(`${API_BASE.replace(/\/$/, '')}/users`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${auditToken}` }, body: JSON.stringify({ name: inviteForm.name, email: inviteForm.email, role:'mentor', password: crypto.randomUUID().slice(0,12) }) });
      if (!res.ok) throw new Error('Invite failed');
      setToast({ msg:'Mentor invited', sev:'success' });
      setInviteOpen(false); setInviteForm({ name:'', email:'' });
    } catch(e:any) { setToast({ msg:e.message || 'Failed', sev:'error' }); }
    finally { setInviteSubmitting(false); }
  };
  const handleBulkUpload = async () => {
    if (!auditToken || !bulkFile) return;
    setBulkUploading(true);
    // Placeholder: just parse rows count and simulate
    try {
      const text = await bulkFile.text();
      const lines = text.split(/\r?\n/).filter(l=> l.trim());
      await new Promise(r=> setTimeout(r, 800));
      setToast({ msg:`Processed ${lines.length} rows (stub)`, sev:'info' });
      setBulkOpen(false); setBulkFile(null);
    } catch(e:any) { setToast({ msg:'Bulk import failed', sev:'error' }); }
    finally { setBulkUploading(false); }
  };
  const handleHealth = async () => {
    if (!auditToken) return;
    setHealthLoading(true); setHealthResult(null);
    try {
      const r = await fetch(`${API_BASE.replace(/\/$/, '')}/health`);
      const j = await r.json();
      setHealthResult(j.ok? 'Healthy' : 'Degraded');
      setToast({ msg:'Health checked', sev:'success' });
    } catch { setHealthResult('Error'); setToast({ msg:'Health check failed', sev:'error' }); }
    finally { setHealthLoading(false); }
  };
  return (
    <Stack spacing={4}>
      <Stack direction={{ xs:'column', md:'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs:'flex-start', md:'center' }}>
        <Typography variant="h4" fontWeight={700}>Overview</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<AddIcon />} disabled={exporting} onClick={onExport}>{exporting? 'Exporting...':'Export Students'}</Button>
          <Button variant="outlined" onClick={()=> window.scrollTo({ top:0, behavior:'smooth'})}>Scroll Top</Button>
        </Stack>
      </Stack>
      <Box sx={{ display:'grid', gap:3, gridTemplateColumns:{ xs:'1fr', lg:'repeat(3,1fr)' } }}>
        <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6" fontWeight={700}>High Risk (Top 5)</Typography>
            <Sparkline data={trendHigh} color={TOKENS.risk.colors.High.light} />
          </Stack>
          <Stack spacing={1.25}>
            {logsLoading && highRisk.length === 0 && Array.from({ length:4 }).map((_,i)=>(<Skeleton key={i} variant="rounded" height={34} />))}
            {!logsLoading && highRisk.length === 0 && <Typography variant="body2" color="text.secondary">No high-risk students.</Typography>}
            {!logsLoading && highRisk.map(s => (
              <Stack key={s.id} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ cursor:'pointer', '&:hover .pk-hover-name':{ textDecoration:'underline' }}} onClick={()=> onOpenStudent(s.id)}>
                <Box sx={{ minWidth:0 }}>
                  <Typography className="pk-hover-name" variant="body2" fontWeight={600} noWrap>{s.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.email}</Typography>
                </Box>
                <RiskBadge tier={s.risk.level as any} />
              </Stack>
            ))}
          </Stack>
        </Paper>
        <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6" fontWeight={700}>Medium Risk (Top 5)</Typography>
            <Sparkline data={trendMedium} color={TOKENS.risk.colors.Medium.light} />
          </Stack>
          <Stack spacing={1.25}>
            {logsLoading && mediumRisk.length === 0 && Array.from({ length:4 }).map((_,i)=>(<Skeleton key={i} variant="rounded" height={34} />))}
            {!logsLoading && mediumRisk.length === 0 && <Typography variant="body2" color="text.secondary">No medium-risk students.</Typography>}
            {!logsLoading && mediumRisk.map(s => (
              <Stack key={s.id} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ cursor:'pointer', '&:hover .pk-hover-name':{ textDecoration:'underline' }}} onClick={()=> onOpenStudent(s.id)}>
                <Box sx={{ minWidth:0 }}>
                  <Typography className="pk-hover-name" variant="body2" fontWeight={600} noWrap>{s.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.email}</Typography>
                </Box>
                <RiskBadge tier={s.risk.level as any} />
              </Stack>
            ))}
          </Stack>
        </Paper>
        <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3, display:'flex', flexDirection:'column' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6" fontWeight={700}>Recent Activity</Typography>
            <Sparkline data={trendLow} color={TOKENS.risk.colors.Low.light} />
          </Stack>
          <Stack spacing={1} sx={{ flex:1 }}>
            {logsLoading && Array.from({ length:6 }).map((_,i)=>(
              <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ width:'100%' }}>
                <Skeleton variant="rounded" width={54} height={20} />
                <Skeleton variant="text" width={60} height={16} />
                <Skeleton variant="text" width="100%" height={16} />
              </Stack>
            ))}
            {!logsLoading && logs.length === 0 && <Typography variant="body2" color="text.secondary">No recent audit entries.</Typography>}
            {!logsLoading && logs.map(l => (
              <Stack key={l.id} direction="row" spacing={1} alignItems="center" sx={{ fontSize:12 }}>
                <Chip size="small" label={l.action} />
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace:'nowrap' }}>{new Date(l.createdAt).toLocaleTimeString()}</Typography>
                <Typography variant="caption" sx={{ flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.details || l.userId || l.actorId || '—'}</Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Box>

      <Box sx={{ display:'grid', gap:3, gridTemplateColumns:{ xs:'1fr', lg:'2fr 1fr' } }}>
        <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
          <Typography variant="h6" fontWeight={700} mb={2}>Quick Actions</Typography>
          <Stack direction={{ xs:'column', sm:'row' }} spacing={2} flexWrap="wrap" alignItems="center">
            <Button variant="outlined" onClick={()=> setInviteOpen(true)}>Invite Mentor</Button>
            <Button variant="outlined" onClick={()=> setBulkOpen(true)}>Bulk Import</Button>
            <Button variant="outlined" onClick={()=> onExport()} disabled={exporting}>{exporting? 'Exporting...':'Export Students'}</Button>
            <Button variant="outlined" onClick={handleHealth} disabled={healthLoading} startIcon={healthLoading? <CircularProgress size={14} />: undefined}>System Health</Button>
            {healthResult && <Chip size="small" label={healthResult} color={healthResult==='Healthy'? 'success': (healthResult==='Error'?'error':'warning')} />}
          </Stack>
        </Paper>
        <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
          <Typography variant="h6" fontWeight={700} mb={1}>Summary</Typography>
          <Stack spacing={1}>
            <Typography variant="body2">Total Students: {students.length}</Typography>
            <Typography variant="body2">High Risk: {students.filter(s=> s.risk.level==='High').length}</Typography>
            <Typography variant="body2">Medium Risk: {students.filter(s=> s.risk.level==='Medium').length}</Typography>
            <Typography variant="body2">Low Risk: {students.filter(s=> s.risk.level==='Low').length}</Typography>
          </Stack>
        </Paper>
      </Box>
      {/* Invite Mentor Dialog */}
      <Dialog open={inviteOpen} onClose={()=> setInviteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Invite Mentor</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:2 }}>
          <TextField label="Name" value={inviteForm.name} onChange={e=> setInviteForm(f=> ({ ...f, name: e.target.value }))} fullWidth />
          <TextField label="Email" type="email" value={inviteForm.email} onChange={e=> setInviteForm(f=> ({ ...f, email: e.target.value }))} fullWidth />
          <Typography variant="caption" color="text.secondary">A temporary password will be auto-generated.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setInviteOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={!inviteForm.email || inviteSubmitting} onClick={handleInvite}>{inviteSubmitting? 'Sending...':'Send Invite'}</Button>
        </DialogActions>
      </Dialog>
      {/* Bulk Import Dialog */}
      <Dialog open={bulkOpen} onClose={()=> setBulkOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Bulk Import Students (CSV)</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:2 }}>
          <Button variant="outlined" component="label">Select CSV<input type="file" accept=".csv" hidden onChange={e=> setBulkFile(e.target.files?.[0] || null)} /></Button>
          {bulkFile && <Typography variant="caption">{bulkFile.name}</Typography>}
          <Typography variant="caption" color="text.secondary">Stub: parses rows client-side only.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setBulkOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!bulkFile || bulkUploading} onClick={handleBulkUpload}>{bulkUploading? 'Processing...':'Import'}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={()=> setToast(null)} anchorOrigin={{ vertical:'bottom', horizontal:'right' }}>
        {toast && <Alert severity={toast.sev} onClose={()=> setToast(null)} variant="filled">{toast.msg}</Alert>}
      </Snackbar>
    </Stack>
  );
};

// Generic user list / management. Optional roleFilter locks creation role.
const UserManagementPage: React.FC<{ token: string | undefined; roleFilter?: string; title?: string; hideRoleSelect?: boolean; }> = ({ token, roleFilter, title='User Management', hideRoleSelect }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ email:'', name:'', role:'viewer', password:'' });
  const [newPassword, setNewPassword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState<string>('');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true); setError(null);
    const qp = new URLSearchParams();
    qp.set('page', String(page));
    qp.set('pageSize', String(pageSize));
    if (roleFilter) qp.set('role', roleFilter);
    if (search.trim()) qp.set('search', search.trim());
    fetch(`${API_BASE.replace(/\/$/, '')}/users?${qp.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r=> { if(!r.ok) throw new Error('List failed'); return r.json(); })
      .then(j=> { setUsers(j.users || []); setTotal(j.total || 0); })
      .catch(e=> setError(e.message))
      .finally(()=> setLoading(false));
  }, [token, roleFilter, page, pageSize, search]);

  useEffect(()=> { load(); }, [load]);

  // debounce search input
  useEffect(()=> {
    const id = setTimeout(()=> { setPage(1); setSearch(pendingSearch); }, 400);
    return ()=> clearTimeout(id);
  }, [pendingSearch]);

  const handleCreate = async () => {
    if (!token) return;
    try {
      await createUser(token, form);
      setCreateOpen(false);
      setForm({ email:'', name:'', role:'viewer', password:'' });
      load();
    } catch(e:any) { setError(e.message); }
  };
  const handleExport = () => {
    if (!token) return;
    const qp = new URLSearchParams();
    if (roleFilter) qp.set('role', roleFilter);
    if (search.trim()) qp.set('search', search.trim());
    const url = `${API_BASE.replace(/\/$/, '')}/users/export.csv?${qp.toString()}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(async r => {
      if(!r.ok) throw new Error('Export failed');
      const blob = await r.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'users_export.csv';
      document.body.appendChild(link); link.click(); setTimeout(()=> { URL.revokeObjectURL(link.href); link.remove(); }, 500);
    }).catch(e=> setError(e.message));
  };

  const confirmRoleChange = async () => {
    if (!token || !editingRoleId) return;
    try {
      await fetch(`${API_BASE.replace(/\/$/, '')}/users/${editingRoleId}/role`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ role: editingRoleValue }) });
      setEditingRoleId(null); setEditingRoleValue(''); load();
    } catch(e:any) { setError(e.message); }
  };
  const handleDelete = async () => {
    if (!token || !deleteId) return;
    try { await deleteUser(token, deleteId); setDeleteId(null); load(); } catch(e:any) { setError(e.message); }
  };
  const handleReset = async () => {
    if (!token || !resetId) return;
    try { await resetUserPassword(token, resetId, newPassword); setResetId(null); setNewPassword(''); } catch(e:any) { setError(e.message); }
  };

  return (
    <Stack spacing={4}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={2}>
        <Typography variant="h4" fontWeight={700}>{title}</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={handleExport}>Export CSV</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={()=> { setCreateOpen(true); if (roleFilter) setForm(f=> ({ ...f, role: roleFilter })); }}>Add {roleFilter? roleFilter.charAt(0).toUpperCase()+roleFilter.slice(1): 'User'}</Button>
        </Stack>
      </Stack>
      <Box sx={{ display:'flex', gap:2, flexWrap:'wrap' }}>
        <TextField size="small" label="Search" value={pendingSearch} onChange={e=> setPendingSearch(e.target.value)} />
        <TextField size="small" select label="Page Size" value={pageSize} onChange={e=> { setPageSize(Number(e.target.value)); setPage(1); }}>
          {[10,25,50,100].map(n=> <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </TextField>
        <Typography variant="body2" sx={{ alignSelf:'center' }}>{total} total</Typography>
      </Box>
      {loading && <Typography variant="body2">Loading users...</Typography>}
      {error && <Typography variant="body2" color="error">{error}</Typography>}
      <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
        <Typography variant="h6" fontWeight={700} mb={2}>All Users</Typography>
        <Box component="table" sx={{ width:'100%', borderCollapse:'collapse', fontSize:14, '& th, & td':{ borderBottom: t=>`1px solid ${t.palette.divider}`, textAlign:'left', p:1 } }}>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  {editingRoleId === u.id ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField select size="small" value={editingRoleValue} onChange={e=> setEditingRoleValue(e.target.value)} sx={{ minWidth:110 }}>
                        {['viewer','counselor','mentor','admin'].map(r=> <MenuItem key={r} value={r}>{r}</MenuItem>)}
                      </TextField>
                      <Button size="small" variant="contained" onClick={confirmRoleChange} disabled={!editingRoleValue}>Save</Button>
                      <Button size="small" onClick={()=> { setEditingRoleId(null); setEditingRoleValue(''); }}>Cancel</Button>
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ textTransform:'capitalize' }}>{u.role}</Typography>
                      <Button size="small" variant="text" onClick={()=> { setEditingRoleId(u.id); setEditingRoleValue(u.role); }}>Edit</Button>
                    </Stack>
                  )}
                </td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={()=> setResetId(u.id)}>Reset PW</Button>
                    <Button size="small" color="error" variant="outlined" onClick={()=> setDeleteId(u.id)}>Delete</Button>
                  </Stack>
                </td>
              </tr>
            ))}
          </tbody>
        </Box>
        <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
          <Button size="small" disabled={page<=1} onClick={()=> setPage(p=> Math.max(1,p-1))}>Prev</Button>
          <Typography variant="body2" sx={{ alignSelf:'center' }}>Page {page} / {totalPages}</Typography>
          <Button size="small" disabled={page>=totalPages} onClick={()=> setPage(p=> Math.min(totalPages,p+1))}>Next</Button>
        </Stack>
      </Paper>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={()=> setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add {roleFilter? roleFilter.charAt(0).toUpperCase()+roleFilter.slice(1): 'User'}</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:2 }}>
          <TextField label="Name" fullWidth value={form.name} onChange={e=> setForm(f=> ({ ...f, name: e.target.value }))} />
          <TextField label="Email" fullWidth type="email" value={form.email} onChange={e=> setForm(f=> ({ ...f, email: e.target.value }))} />
            <TextField label="Role" select fullWidth value={form.role} disabled={!!roleFilter || hideRoleSelect} onChange={e=> setForm(f=> ({ ...f, role: e.target.value }))}>
              <MenuItem value="viewer">Viewer</MenuItem>
              <MenuItem value="counselor">Counselor</MenuItem>
              <MenuItem value="mentor">Mentor</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </TextField>
          <TextField label="Password" fullWidth type="password" value={form.password} onChange={e=> setForm(f=> ({ ...f, password: e.target.value }))} helperText="Min 8 characters" />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setCreateOpen(false)}>Cancel</Button>
          <Button onClick={()=> { if (roleFilter) { handleCreate(); } else { handleCreate(); } }} variant="contained" disabled={!form.email || form.password.length<8}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetId} onClose={()=> setResetId(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:2 }}>
          <TextField label="New Password" type="password" value={newPassword} onChange={e=> setNewPassword(e.target.value)} helperText="Min 8 characters" />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setResetId(null)}>Cancel</Button>
          <Button variant="contained" disabled={newPassword.length<8} onClick={handleReset}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onClose={()=> setDeleteId(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Are you sure you want to delete this user? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setDeleteId(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

import { getMe, updateMe, changeMyPassword } from '../auth/api';

const ProfilePage: React.FC<{ token: string; onLogout: ()=>void; }> = ({ token, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [data, setData] = useState<{ name:string; email:string; role:string } | null>(null);
  const [form, setForm] = useState({ name:'', email:'' });
  const [pwdForm, setPwdForm] = useState({ current:'', next:'', confirm:'' });
  const dirty = data && (form.name !== data.name || form.email !== data.email);
  useEffect(()=> {
    setLoading(true); setError(null);
    getMe(token).then(r => { setData(r.user); setForm({ name:r.user.name, email:r.user.email }); }).catch(e=> setError(e.message)).finally(()=> setLoading(false));
  }, [token]);
  const saveProfile = async () => {
    if (!dirty) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const r = await updateMe(token, { name: form.name !== data!.name ? form.name : undefined, email: form.email !== data!.email ? form.email : undefined });
      if (r.requireRelogin) { setSuccess('Profile updated. Please login again.'); setTimeout(()=> onLogout(), 1300); return; }
      setData(r.user); setSuccess('Profile saved');
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };
  const changePassword = async () => {
    if (!pwdForm.current || !pwdForm.next || pwdForm.next !== pwdForm.confirm) return;
    setPwdSaving(true); setError(null); setSuccess(null);
    try {
      const r = await changeMyPassword(token, { currentPassword: pwdForm.current, newPassword: pwdForm.next });
      if (r.requireRelogin) { setSuccess('Password changed. Re-authenticating...'); setTimeout(()=> onLogout(), 1200); }
    } catch(e:any) { setError(e.message); }
    finally { setPwdSaving(false); setPwdForm({ current:'', next:'', confirm:'' }); }
  };
  const pwdWeak = pwdForm.next && pwdForm.next.length < 8;
  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3, position:'relative' }}>
        <Typography variant="h5" fontWeight={700} mb={1}>My Profile</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>Update your personal information. Changing email or password will require signing in again.</Typography>
        {loading && <Typography variant="body2">Loading profile...</Typography>}
        {error && <Alert severity="error" sx={{ mb:2 }} onClose={()=> setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb:2 }} onClose={()=> setSuccess(null)}>{success}</Alert>}
        {data && (
          <Stack spacing={2}>
            <Stack direction={{ xs:'column', sm:'row' }} spacing={2}>
              <TextField label="Name" fullWidth value={form.name} onChange={e=> setForm(f=> ({ ...f, name: e.target.value }))} />
              <TextField label="Email" type="email" fullWidth value={form.email} onChange={e=> setForm(f=> ({ ...f, email: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={!dirty || saving} onClick={saveProfile}>{saving? 'Saving...':'Save Changes'}</Button>
              {dirty && <Button disabled={saving} onClick={()=> setForm({ name:data.name, email:data.email })}>Reset</Button>}
            </Stack>
            <Divider />
            <Typography variant="h6" fontWeight={600}>Change Password</Typography>
            <Stack direction={{ xs:'column', sm:'row' }} spacing={2}>
              <TextField label="Current Password" type="password" fullWidth value={pwdForm.current} onChange={e=> setPwdForm(f=> ({ ...f, current: e.target.value }))} />
              <TextField label="New Password" type="password" fullWidth value={pwdForm.next} error={pwdWeak} helperText={pwdWeak ? 'Min 8 chars' : undefined} onChange={e=> setPwdForm(f=> ({ ...f, next: e.target.value }))} />
              <TextField label="Confirm" type="password" fullWidth value={pwdForm.confirm} error={!!pwdForm.confirm && pwdForm.confirm !== pwdForm.next} helperText={(pwdForm.confirm && pwdForm.confirm !== pwdForm.next) ? 'Does not match' : undefined} onChange={e=> setPwdForm(f=> ({ ...f, confirm: e.target.value }))} />
            </Stack>
            <Button variant="outlined" disabled={Boolean(pwdSaving || !pwdForm.current || !pwdForm.next || pwdForm.next !== pwdForm.confirm || pwdWeak)} onClick={changePassword}>{pwdSaving? 'Updating...':'Update Password'}</Button>
            <Divider />
            <Stack spacing={1}>
              <Typography variant="subtitle2" fontWeight={600}>Account Role</Typography>
              <Chip label={data.role} size="small" />
            </Stack>
          </Stack>
        )}
      </Paper>
      <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
        <Typography variant="h6" fontWeight={600} mb={1}>Security Tips</Typography>
        <Typography variant="body2" color="text.secondary">Use a strong password and avoid reusing credentials across services. After changing password you must login again.</Typography>
      </Paper>
    </Stack>
  );
};

const SettingsPage: React.FC = () => {
  const { dark, toggleDark } = useDarkMode();
  return (
    <Stack spacing={4}>
      <Typography variant="h4" fontWeight={700}>Settings</Typography>
      <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>Appearance</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>Choose how the dashboard looks.</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {/* If we are currently dark, clicking Light toggles; if already light, do nothing */}
          <Button fullWidth variant={!dark ? 'contained':'outlined'} startIcon={<ColorLensIcon />} onClick={()=> dark && toggleDark()}>Light Mode</Button>
          {/* If we are currently light, clicking Dark toggles; if already dark, do nothing */}
          <Button fullWidth variant={dark ? 'contained':'outlined'} startIcon={<ColorLensIcon />} onClick={()=> !dark && toggleDark()}>Dark Mode</Button>
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>Account</Typography>
        <Typography variant="body2" color="text.secondary">Additional account settings to be added.</Typography>
      </Paper>
    </Stack>
  );
};

const AuditLogsPage: React.FC<{ token: string | undefined }> = ({ token }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true); setError(null);
    fetchAuditLogs(token, { page, pageSize })
      .then(r => { setLogs(r.logs); setTotal(r.total); })
      .catch(e => setError(e.message))
      .finally(()=> setLoading(false));
  }, [token, page, pageSize]);

  useEffect(()=> { load(); }, [load]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
        <Typography variant="h4" fontWeight={700}>Audit Logs</Typography>
        <TextField select size="small" label="Page Size" value={pageSize} onChange={e=> { setPageSize(Number(e.target.value)); setPage(1); }}>
          {[25,50,100,200].map(n=> <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </TextField>
      </Stack>
      {loading && (
        <Stack spacing={0.6}>
          {Array.from({ length:10 }).map((_,i)=>(<Skeleton key={i} variant="rounded" height={28} />))}
        </Stack>
      )}
      {error && <Typography variant="body2" color="error">{error}</Typography>}
      <Paper elevation={0} sx={{ p:2, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3, overflowX:'auto' }}>
        <Box component="table" sx={{ width:'100%', borderCollapse:'collapse', fontSize:13, '& th, & td':{ borderBottom: t=>`1px solid ${t.palette.divider}`, p:0.75, textAlign:'left' } }}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Actor</th>
              <th>User</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
                <td><Chip size="small" label={l.action} /></td>
                <td>{l.actorId || '-'}</td>
                <td>{l.userId || '-'}</td>
                <td style={{ maxWidth: 320, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.details || ''}</td>
              </tr>
            ))}
            {logs.length === 0 && !loading && <tr><td colSpan={5}><Typography variant="body2" color="text.secondary">No logs.</Typography></td></tr>}
          </tbody>
        </Box>
        <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
          <Button size="small" disabled={page<=1} onClick={()=> setPage(p=> Math.max(1,p-1))}>Prev</Button>
          <Typography variant="body2" sx={{ alignSelf:'center' }}>Page {page} / {totalPages}</Typography>
          <Button size="small" disabled={page>=totalPages} onClick={()=> setPage(p=> Math.min(totalPages,p+1))}>Next</Button>
        </Stack>
      </Paper>
    </Stack>
  );
};

// Risk Model Configuration Page
const RiskConfigPage: React.FC<{ token: string }> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [weights, setWeights] = useState<{ attendance:number; gpa:number; assignments:number; notes:number }>({ attendance:0.3, gpa:0.4, assignments:0.2, notes:0.1 });
  const [thresholds, setThresholds] = useState<{ high:number; medium:number }>({ high:0.7, medium:0.4 });
  const [version, setVersion] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(()=> {
    setLoading(true); setError(null);
    fetchRiskConfig(token)
      .then(r => {
        const w = r.config.weights || {};
        setWeights({
          attendance: Number(w.attendance ?? 0.3),
            gpa: Number(w.gpa ?? 0.4),
          assignments: Number(w.assignments ?? 0.2),
          notes: Number(w.notes ?? 0.1)
        });
        const th = r.config.thresholds || {};
        setThresholds({ high: Number(th.high ?? 0.7), medium: Number(th.medium ?? 0.4) });
        setVersion(r.config.version);
        setUpdatedAt(r.config.updatedAt);
      })
      .catch(e=> setError(e.message))
      .finally(()=> setLoading(false));
  }, [token]);

  const totalWeight = weights.attendance + weights.gpa + weights.assignments + weights.notes;
  const weightWarn = Math.abs(totalWeight - 1) > 0.05;
  const thresholdWarn = !(thresholds.medium < thresholds.high);
  const dirty = success == null; // simplistic; real implementation would compare cached baseline

  const updateWeight = (key: keyof typeof weights, value: string) => {
    const num = Number(value); if (isNaN(num)) return; setWeights(w=> ({ ...w, [key]: num })); setSuccess(null);
  };
  const updateThreshold = (key: keyof typeof thresholds, value: string) => {
    const num = Number(value); if (isNaN(num)) return; setThresholds(t=> ({ ...t, [key]: num })); setSuccess(null);
  };
  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const r = await saveRiskConfig(token, weights as any, thresholds as any);
      setVersion(r.config.version); setUpdatedAt(r.config.updatedAt);
      setSuccess('Configuration saved');
    } catch(e:any) { setError(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };
  return (
    <Stack spacing={4}>
      <Stack direction={{ xs:'column', md:'row' }} justifyContent="space-between" alignItems={{ xs:'flex-start', md:'center' }} spacing={2}>
        <Typography variant="h4" fontWeight={700}>Risk Model</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" disabled={saving || weightWarn || thresholdWarn} onClick={handleSave}>{saving? 'Saving...':'Save'}</Button>
        </Stack>
      </Stack>
      <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3, display:'flex', flexDirection:'column', gap:3 }}>
        <Typography variant="h6" fontWeight={700}>Weights</Typography>
        {loading && <LinearProgress />}
        {error && <Alert severity="error" onClose={()=> setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" onClose={()=> setSuccess(null)}>{success}</Alert>}
        <Stack direction={{ xs:'column', md:'row' }} spacing={2}>
          <TextField label="Attendance" type="number" value={weights.attendance} onChange={e=> updateWeight('attendance', e.target.value)} inputProps={{ step:'0.05', min:'0', max:'1' }} fullWidth size="small" />
          <TextField label="GPA" type="number" value={weights.gpa} onChange={e=> updateWeight('gpa', e.target.value)} inputProps={{ step:'0.05', min:'0', max:'1' }} fullWidth size="small" />
          <TextField label="Assignments" type="number" value={weights.assignments} onChange={e=> updateWeight('assignments', e.target.value)} inputProps={{ step:'0.05', min:'0', max:'1' }} fullWidth size="small" />
          <TextField label="Notes" type="number" value={weights.notes} onChange={e=> updateWeight('notes', e.target.value)} inputProps={{ step:'0.05', min:'0', max:'1' }} fullWidth size="small" />
        </Stack>
        <Typography variant="body2" color={weightWarn? 'warning.main':'text.secondary'}>Sum = {totalWeight.toFixed(2)} {weightWarn && '(recommend ≈ 1.00)'}</Typography>
        <Divider />
        <Typography variant="h6" fontWeight={700}>Thresholds</Typography>
        <Stack direction={{ xs:'column', md:'row' }} spacing={2}>
          <TextField label="Medium ≥" type="number" value={thresholds.medium} onChange={e=> updateThreshold('medium', e.target.value)} inputProps={{ step:'0.05', min:'0', max:'1' }} fullWidth size="small" />
          <TextField label="High ≥" type="number" value={thresholds.high} onChange={e=> updateThreshold('high', e.target.value)} inputProps={{ step:'0.05', min:'0', max:'1' }} fullWidth size="small" />
        </Stack>
        <Typography variant="body2" color={thresholdWarn? 'warning.main':'text.secondary'}>{thresholdWarn? 'Medium threshold should be less than High threshold':'Threshold ordering OK'}</Typography>
        <Divider />
        <Stack direction={{ xs:'column', sm:'row' }} spacing={2} alignItems={{ sm:'center' }}>
          <Chip size="small" label={`Version ${version ?? '—'}`} />
          <Chip size="small" label={updatedAt? `Updated ${new Date(updatedAt).toLocaleString()}`: 'Not Updated'} />
          {weightWarn && <Chip size="small" color="warning" label="Adjust weights" />}
          {thresholdWarn && <Chip size="small" color="warning" label="Adjust thresholds" />}
        </Stack>
        <Typography variant="caption" color="text.secondary">Changing weights spawns a new active version. Historical versions are retained server-side for future audits.</Typography>
      </Paper>
    </Stack>
  );
};

// --- Layout shell ---
const AdminApp: React.FC = () => {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  // dark mode now controlled globally via context
  const [page, setPage] = useState<'dashboard' | 'users' | 'admins' | 'mentors' | 'counselors' | 'students' | 'audit' | 'profile' | 'settings' | 'overview' | 'notifications' | 'import' | 'riskconfig'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [searchDebounceId, setSearchDebounceId] = useState<number | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Role guard
  const decodedRole = React.useMemo(() => {
    try { if (!session?.token) return undefined; const p = JSON.parse(atob(session.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); return p.role || p.user?.role; } catch { return undefined; }
  }, [session]);
  if (!session) return <Typography sx={{ p:4 }}>Not authenticated.</Typography>;
  if (decodedRole !== 'admin') {
    return <Box sx={{ p:4 }}><Typography variant="h5" fontWeight={700}>Unauthorized</Typography><Typography variant="body2" color="text.secondary">Admin role required.</Typography></Box>;
  }

  const fetchStudents = useCallback((overrideSearch?: string) => {
    if (!session?.token) return;
    setLoading(true); setErr(null);
    const q = (overrideSearch ?? search).trim();
    const url = `${API.students}?page=1&pageSize=50${q? `&search=${encodeURIComponent(q)}`:''}`;
    fetch(url, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then(json => {
        const raw = (json.data || json.students || []);
        const mapped: AdminStudent[] = raw.map((s:any, i:number) => {
          const attendance = 60 + ((i*13)%35);
          const gpa = 2.0 + ((i*37)%20)/10;
          const assignmentsSubmitted = 50 + ((i*11)%50);
          const lastExamScore = 55 + ((i*17)%45);
          const norm = normalizeRisk({ backendScore: s.riskScore, backendTier: s.riskTier, fallbackMetrics: { attendance, gpa, assignmentsSubmitted } });
          return {
            id: s.id || `stu-${i}`,
            name: s.name || `Student ${i+1}`,
            email: s.email || `student${i+1}@example.com`,
            attendance,
            gpa,
            assignmentsSubmitted,
            lastExamScore,
            risk: { level: norm.level, score: norm.score ?? 0 }
          };
        });
        setStudents(mapped);
      })
      .catch(e => setErr(e.message))
      .finally(()=> setLoading(false));
  }, [session, search]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // Debounce search input changes -> update search state triggers data fetch
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPendingSearch(value);
    if (searchDebounceId) window.clearTimeout(searchDebounceId);
    const id = window.setTimeout(() => {
      setSearch(value);
    }, 400);
    setSearchDebounceId(id);
  };

  const mentors = useMemo(() => placeholderMentors, []);

  const handleExport = useCallback(() => {
    if (!session?.token || exporting) return;
    setExporting(true);
    const url = `${API.students}/export.csv`;
    fetch(url, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async r => {
        if (!r.ok) throw new Error(`Export failed (${r.status})`);
        const blob = await r.blob();
        const filename = (() => {
          const dispo = r.headers.get('Content-Disposition');
            if (dispo) {
              const m = dispo.match(/filename="?([^";]+)"?/i); if (m) return m[1];
            }
            return 'students_export.csv';
        })();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(()=> { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
      })
      .catch(e => setErr(e.message))
      .finally(()=> setExporting(false));
  }, [session, exporting]);

  const pageOrder: Array<typeof page> = ['dashboard','overview','users','admins','mentors','students','counselors','audit','notifications','riskconfig','import','profile','settings'];
  const renderPage = () => {
    switch (page) {
      case 'dashboard':
  return <DashboardPage students={students} mentors={mentors} onExport={handleExport} exporting={exporting} token={session?.token} />;
      case 'overview':
        return <OverviewPage students={students} auditToken={session?.token} onExport={handleExport} exporting={exporting} onOpenStudent={(id)=> setProfileId(id)} />;
      case 'users':
        return <UserManagementPage token={session?.token} />;
      case 'admins':
        return <UserManagementPage token={session?.token} roleFilter="admin" title="Manage Admins" hideRoleSelect />;
      case 'mentors':
        return <UserManagementPage token={session?.token} roleFilter="mentor" title="Manage Mentors" hideRoleSelect />;
      case 'students':
        return (
          <Paper elevation={0} sx={{ p:3, border: t=>`1px solid ${t.palette.divider}`, borderRadius:3 }}>
            <Typography variant="h5" fontWeight={700} mb={2}>Manage Students</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>Search box (top) filters this list.</Typography>
            <Box component="table" sx={{ width:'100%', borderCollapse:'collapse', fontSize:14, '& th, & td':{ borderBottom: t=>`1px solid ${t.palette.divider}`, textAlign:'left', p:1 } }}>
              <thead>
                <tr><th>Name</th><th>Email</th><th>GPA</th><th>Attendance</th><th>Risk</th></tr>
              </thead>
              <tbody>
                {students.map(s => <tr key={s.id} style={{ cursor:'pointer' }} onClick={()=> setProfileId(s.id)}><td>{s.name}</td><td>{s.email}</td><td>{s.gpa.toFixed(1)}</td><td>{s.attendance}%</td><td><RiskBadge tier={s.risk.level as any} /></td></tr>)}
              </tbody>
            </Box>
          </Paper>
        );
      case 'counselors':
        return <UserManagementPage token={session?.token} roleFilter="counselor" title="Manage Counselors" hideRoleSelect />;
      case 'audit':
        return <AuditLogsPage token={session?.token} />;
      case 'notifications':
        return <Notifications />;
      case 'import':
        return <StudentImport />;
      case 'profile':
        return session?.token ? <ProfilePage token={session.token} onLogout={logout} /> : null;
      case 'settings':
        return <SettingsPage />;
      case 'riskconfig':
        return <RiskConfigPage token={session.token} />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display:'flex', minHeight:'100vh', bgcolor: theme=> theme.palette.background.default }}>
      {/* Sidebar */}
      <Box sx={{ width: sidebarOpen? 250: 74, transition:'width 240ms', borderRight: theme=> `1px solid ${theme.palette.divider}`, display:'flex', flexDirection:'column' }}>
        <Box sx={{ p:1.5, display:'flex', alignItems:'center', justifyContent: sidebarOpen? 'space-between':'center' }}>
          {sidebarOpen && <Typography variant="h6" fontWeight={700}>Admin</Typography>}
          <IconButton size="small" onClick={()=> setSidebarOpen(o=>!o)}><MenuIcon fontSize="small" /></IconButton>
        </Box>
        <Divider />
        <Stack spacing={0.5} sx={{ p:1.5, flex:1 }}>
          <NavBtn active={page==='dashboard'} icon={<SpaceDashboardIcon fontSize="small" />} label="Admin Dashboard" onClick={()=> setPage('dashboard')} open={sidebarOpen} />
          <NavBtn active={page==='users'} icon={<GroupIcon fontSize="small" />} label="All Users" onClick={()=> setPage('users')} open={sidebarOpen} />
          <NavBtn active={page==='admins'} icon={<GroupIcon fontSize="small" />} label="Admins" onClick={()=> setPage('admins')} open={sidebarOpen} />
          <NavBtn active={page==='mentors'} icon={<GroupIcon fontSize="small" />} label="Mentors" onClick={()=> setPage('mentors')} open={sidebarOpen} />
          <NavBtn active={page==='students'} icon={<GroupIcon fontSize="small" />} label="Students" onClick={()=> setPage('students')} open={sidebarOpen} />
          <NavBtn active={page==='counselors'} icon={<GroupIcon fontSize="small" />} label="Counselors" onClick={()=> setPage('counselors')} open={sidebarOpen} />
          <NavBtn active={page==='audit'} icon={<SpaceDashboardIcon fontSize="small" />} label="Audit Logs" onClick={()=> setPage('audit')} open={sidebarOpen} />
          <Divider flexItem sx={{ my:1 }} />
          <NavBtn active={page==='overview'} icon={<SpaceDashboardIcon fontSize="small" />} label="Overview" onClick={()=> setPage('overview')} open={sidebarOpen} />
          <NavBtn active={page==='notifications'} icon={<SpaceDashboardIcon fontSize="small" />} label="Notifications" onClick={()=> setPage('notifications')} open={sidebarOpen} />
          <NavBtn active={page==='riskconfig'} icon={<SettingsIcon fontSize="small" />} label="Risk Model" onClick={()=> setPage('riskconfig')} open={sidebarOpen} />
          <NavBtn active={page==='import'} icon={<SettingsIcon fontSize="small" />} label="Import" onClick={()=> setPage('import')} open={sidebarOpen} />
          <Divider flexItem sx={{ my:1 }} />
          <NavBtn active={page==='profile'} icon={<PersonIcon fontSize="small" />} label="Profile" onClick={()=> setPage('profile')} open={sidebarOpen} />
          <NavBtn active={page==='settings'} icon={<SettingsIcon fontSize="small" />} label="Settings" onClick={()=> setPage('settings')} open={sidebarOpen} />
        </Stack>
        <Divider />
        <Stack spacing={1.5} sx={{ p:1.5 }}>
          <Button size="small" variant="outlined" startIcon={<LogoutIcon fontSize="small" />} onClick={()=> logout()} sx={{ justifyContent: sidebarOpen? 'flex-start':'center' }}>{sidebarOpen? 'Logout':'Out'}</Button>
        </Stack>
      </Box>
      {/* Main */}
      <Box sx={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Box component="header" sx={{ position:'sticky', top:0, zIndex:5, backdropFilter:'blur(12px)', bgcolor: theme=> theme.palette.background.paper + 'CC', borderBottom: theme=> `1px solid ${theme.palette.divider}`, px:3, py:1.5, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flex:1, minWidth:0 }}>
            <Box sx={{ position:'relative', width: sidebarOpen? 260: 200, maxWidth: '60%' }}>
              <SearchIcon fontSize="small" style={{ position:'absolute', top:8, left:8, opacity:0.6 }} />
              <input
                placeholder="Search students..."
                value={pendingSearch}
                onChange={handleSearchChange}
                style={{ width:'100%', padding:'8px 10px 8px 30px', borderRadius:8, outline:'none', border:'1px solid rgba(0,0,0,0.2)', background:'transparent', color:'inherit' }}
              />
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={2}>
            <ApiStatus />
            <IconButton size="small"><ChatBubbleOutlineIcon fontSize="small" /></IconButton>
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar sx={{ width:40, height:40, bgcolor:'primary.main' }}>{decodedRole?.charAt(0).toUpperCase() || 'A'}</Avatar>
              <Box sx={{ display: { xs:'none', sm:'block' } }}>
                <Typography variant="subtitle2" fontWeight={600} noWrap>{decodedRole || 'Admin'}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>{(session as any)?.email || 'admin@example.com'}</Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>
  <Box component="main" sx={{ flex:1, px:{ xs:2, md:3 }, py:{ xs:2, md:3 }, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
          {loading && <Typography variant="body2">Loading students...</Typography>}
          {err && <Typography color="error" variant="body2" sx={{ mb:1 }}>{err}</Typography>}
          {/** Determine direction (forward/backward) based on index in pageOrder for slide animation */}
          {(() => {
            const currentIdx = pageOrder.indexOf(page);
            const prevIdx = pageOrder.indexOf((renderPage as any)._prevPage || page);
            const direction = currentIdx >= prevIdx ? 'forward' : 'backward';
            (renderPage as any)._prevPage = page;
            // Choose variant: dashboard/overview -> scale, settings/profile -> stack, others -> slide
            let variant: 'fade' | 'slide' | 'scale' | 'stack' = 'slide';
            if (page === 'dashboard') variant = 'scale';
            else if (page === 'overview') variant = 'stack';
            else if (['settings','profile'].includes(page)) variant = 'stack';
            return (
              <PageTransition pageKey={page} variant={variant} direction={direction as any}>
                {renderPage()}
              </PageTransition>
            );
          })()}
        </Box>
        {/** Student Profile Drawer */}
        <StudentProfileDrawer
          open={!!profileId}
          student={profileId ? students.find(s=> s.id===profileId) || null : null}
          onClose={()=> setProfileId(null)}
        />
      </Box>
    </Box>
  );
};

const NavBtn: React.FC<{ active: boolean; icon: React.ReactNode; label: string; onClick: ()=>void; open: boolean; }> = ({ active, icon, label, onClick, open }) => (
  <Button onClick={onClick} startIcon={open? icon: undefined} size="small" variant={active? 'contained':'text'} fullWidth sx={{ justifyContent: open? 'flex-start':'center', fontWeight:600, borderRadius:2, minHeight:38 }}>{open? label: (active? icon: icon)}</Button>
);

export default AdminApp;

