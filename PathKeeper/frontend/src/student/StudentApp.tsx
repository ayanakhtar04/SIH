import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { normalizeRisk, syntheticRiskFromMetrics } from '../risk/riskUtil';
import { useDarkMode } from '../theme/DarkModeContext';
import { Box, Stack, Typography, Paper, IconButton, Button, Divider, Chip, Switch, Table, TableHead, TableBody, TableRow, TableCell, TableContainer } from '@mui/material';
import RiskBadge from '../components/RiskBadge';
import StatCard from '../components/StatCard';
import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import LogoutIcon from '@mui/icons-material/Logout';
import SchoolIcon from '@mui/icons-material/School';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Groups2Icon from '@mui/icons-material/Groups2';
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../auth/AuthContext';
import { API } from '../api';
import { fetchMy360, Student360Data } from '../mentor/student360Api';

// Synthetic fallbacks (performance history & courses) until backend provides richer student metrics
const fallbackPerformanceHistory = [
  { month: 'Jan', score: 60 }, { month: 'Feb', score: 55 }, { month: 'Mar', score: 62 },
  { month: 'Apr', score: 55 }, { month: 'May', score: 58 }, { month: 'Jun', score: 52 }
];
const fallbackAttendanceHistory = [
  { month: 'Jan', pct: 92 }, { month: 'Feb', pct: 88 }, { month: 'Mar', pct: 85 },
  { month: 'Apr', pct: 80 }, { month: 'May', pct: 76 }, { month: 'Jun', pct: 72 }
];
const fallbackCourses = [
  { id: 'C101', name: 'Introduction to Physics', grade: 'C' },
  { id: 'C102', name: 'Calculus I', grade: 'B' },
  { id: 'C103', name: 'English Composition', grade: 'B' },
  { id: 'C104', name: 'Data Structures', grade: 'C+' }
];
const fallbackInterventions = [
  { date: '2025-10-12', text: 'Advisor emailed study plan template.' },
  { date: '2025-10-20', text: 'Mentor check-in recommended by system.' }
];
const fallbackRawRows = [
  { type: 'Attendance', when: '2025-10-01', value: '78%' },
  { type: 'Quiz', when: '2025-10-05', value: '62/100' },
  { type: 'Assignment', when: '2025-10-10', value: 'Completed (8/10)' }
];

// XAI-style summary based on simple heuristics
const XAISummary: React.FC<{ student: ViewStudent }> = ({ student }) => {
  const drivers: string[] = [];
  if (student.attendance < 75) drivers.push(`Attendance currently ${student.attendance}% (target 85%+)`);
  if (student.gpa < 6) drivers.push(`GPA is ${student.gpa.toFixed(1)} (needs improvement)`);
  if (student.assignmentsSubmitted < 70) drivers.push(`Assignment submission rate ${student.assignmentsSubmitted}% (low)`);
  if (drivers.length === 0) drivers.push('No critical risk drivers detected at the moment. Keep up the good work!');
  return (
    <Paper elevation={0} sx={{ p: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3 }}>
      <Typography variant="h6" fontWeight={700} mb={1}>Why you are flagged</Typography>
      <Typography variant="body2" color="text.secondary" mb={1.2}>
        PathKeepers! currently classifies you as <strong>{student.risk.level}</strong> risk.
      </Typography>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {drivers.map((d, i) => <li key={i}><Typography variant="body2">{d}</Typography></li>)}
      </ul>
    </Paper>
  );
};

const PerformanceTrend: React.FC<{ data: { month: string; score: number }[] }> = ({ data }) => (
  <Box sx={{ height: 260 }}>
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

const AttendanceTrend: React.FC<{ data: { month: string; pct: number }[] }> = ({ data }) => (
  <Box sx={{ height: 220 }}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: -5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis domain={[0, 100]} />
        <ReTooltip />
        <Line type="monotone" dataKey="pct" stroke="#1976d2" strokeWidth={2} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  </Box>
);

const CoursesList: React.FC<{ courses: { id: string; name: string; grade: string }[] }> = ({ courses }) => (
  <Paper elevation={0} sx={{ p: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3 }}>
    <Typography variant="h6" fontWeight={700} mb={2}>My Courses</Typography>
    <Stack spacing={1.2}>
      {courses.map(c => (
        <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.2, borderRadius: 2, bgcolor: t => t.palette.action.hover }}>
          <Typography variant="subtitle2" fontWeight={600} noWrap>{c.name}</Typography>
          <Chip label={c.grade} color="primary" size="small" />
        </Box>
      ))}
    </Stack>
  </Paper>
);

const HistoryList: React.FC<{ items: { date: string; text: string }[] }> = ({ items }) => (
  <Paper elevation={0} sx={{ p: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3 }}>
    <Typography variant="h6" fontWeight={700} mb={1}>Intervention History</Typography>
    <Stack spacing={1}>
      {items.map((it, idx) => (
        <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 96 }}>{new Date(it.date).toLocaleDateString()}</Typography>
          <Typography variant="body2">{it.text}</Typography>
        </Box>
      ))}
      {items.length === 0 && <Typography variant="body2" color="text.secondary">No items yet.</Typography>}
    </Stack>
  </Paper>
);

const RawDataTable: React.FC<{ rows: { type: string; when: string; value: string }[] }> = ({ rows }) => (
  <Paper elevation={0} sx={{ p: 2, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3 }}>
    <Typography variant="h6" fontWeight={700} mb={1}>My Data (Recent)</Typography>
    <TableContainer>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Type</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Value</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{r.type}</TableCell>
              <TableCell>{new Date(r.when).toLocaleDateString()}</TableCell>
              <TableCell>{r.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>
);

interface ViewStudent {
  id: string;
  name: string;
  email: string;
  attendance: number;
  gpa: number;
  assignmentsSubmitted: number;
  lastExamScore: number;
  performanceHistory: { month: string; score: number }[];
  courses: { id: string; name: string; grade: string }[];
  risk: { level: string; score: number };
  // enriched from backend self endpoint
  studentCode?: string;
  program?: string | null;
  year?: number | null;
  lastRiskUpdated?: string | null;
  mentorId?: string | null;
}

const DashboardPage: React.FC<{ student: ViewStudent; attendanceSeries: { month:string; pct:number }[]; interventions: { date:string; text:string }[]; rawRows: { type:string; when:string; value:string }[] }> = ({ student, attendanceSeries, interventions, rawRows }) => {
  const lastUpdatedChip = (() => {
    if (!student.lastRiskUpdated) return <Chip size="small" variant="outlined" label="Updated: —" />;
    const ts = new Date(student.lastRiskUpdated).getTime();
    const ageDays = Math.max(0, Math.floor((Date.now() - ts) / 86400000));
    const label = ageDays === 0 ? 'Updated: Today' : ageDays === 1 ? 'Updated: 1d' : `Updated: ${ageDays}d`;
    return <Chip size="small" variant={ageDays > 30 ? 'filled' : 'outlined'} color={ageDays > 30 ? 'warning' : 'default'} label={label} />;
  })();

  // Build short encouragement + 2-3 practical tips based on current risk and metrics
  const encouragement = (() => {
    const affirmations = [
      'Small consistent steps add up—keep going!',
      'You’re closer than you think. Stay steady.',
      'Progress beats perfection. One task at a time.',
      'Your effort matters—show up today and win the day.'
    ];
    const tipPool: Record<string, string[]> = {
      high: [
        'Attend at least 4 of 5 classes this week—consistency first.',
        'Book a quick check‑in with your mentor to plan the next two weeks.',
        'Focus on due assignments—finish one today and one tomorrow.'
      ],
      medium: [
        'Set a 25‑minute study sprint for your toughest subject today.',
        'Join a study group or ask a friend to review one topic together.',
        'Track attendance for the next 7 days—aim for 85%+.'
      ],
      low: [
        'Great momentum—keep your current routine for the next week.',
        'Pick one stretch goal (bonus problem or revision topic) this week.',
        'Share what’s working with a friend—teaching reinforces learning.'
      ],
      unknown: ['Collect a bit more data this week, then reassess your plan.']
    };
    // Tailor a couple of tips based on personal metrics
    const custom: string[] = [];
    if (student.attendance < 75) custom.push('Aim for 3–4 on‑time classes this week to rebuild rhythm.');
    if (student.gpa < 6) custom.push('Schedule two 30‑min revision blocks for core concepts.');
    if (student.assignmentsSubmitted < 70) custom.push('List pending assignments and submit the easiest one today.');
    const pool = tipPool[student.risk.level.toLowerCase()] || tipPool.unknown;
    const tips = [...custom, ...pool].slice(0, 3);
    const positive = affirmations[Math.floor(Math.random() * affirmations.length)];
    return { positive, tips };
  })();
  return (
    <Stack spacing={4}>
      {/* Header + Chips */}
      <Stack spacing={1}>
        <Typography variant="h4" fontWeight={700}>Welcome back, {student.name.split(' ')[0]}!</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <RiskBadge tier={student.risk.level as any} />
          {(student.program || student.year != null) && (
            <Chip size="small" variant="outlined" label={`${student.program || 'Program'}${student.year != null ? ` • Year ${student.year}` : ''}`} />
          )}
          {lastUpdatedChip}
        </Stack>
      </Stack>

      {/* KPIs */}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(2,1fr)', lg: 'repeat(4,1fr)' } }}>
        <StatCard title="Overall GPA" value={student.gpa.toFixed(1)} change="Keep it up!" icon={<TrendingUpIcon fontSize="small" />} />
        <StatCard title="Attendance" value={`${student.attendance}%`} change="Aim for 90%+" icon={<Groups2Icon fontSize="small" />} />
        <StatCard title="Assignments" value={`${student.assignmentsSubmitted}%`} change="Submitted" icon={<TaskAltIcon fontSize="small" />} />
        <StatCard title="Courses" value={student.courses.length} change="Enrolled" icon={<SchoolIcon fontSize="small" />} />
      </Box>

      {/* XAI + History */}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <XAISummary student={student} />
        <HistoryList items={interventions} />
      </Box>

      {/* Encouragement & Tips */}
      <Paper elevation={0} sx={{ p: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3 }}>
        <Stack spacing={1}>
          <Typography variant="h6" fontWeight={700}>Encouragement & Tips</Typography>
          <Typography variant="body2" color="text.secondary">
            Based on your current status ({student.risk.level} risk):
          </Typography>
          <Typography variant="subtitle2" fontWeight={700}>{encouragement.positive}</Typography>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {encouragement.tips.map((t, i) => (
              <li key={i}><Typography variant="body2">{t}</Typography></li>
            ))}
          </ul>
        </Stack>
      </Paper>

      {/* Trends */}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Paper elevation={0} sx={{ p: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6" fontWeight={700}>Attendance Trend</Typography>
          </Stack>
          <AttendanceTrend data={attendanceSeries} />
        </Paper>
        <Paper elevation={0} sx={{ p: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6" fontWeight={700}>Score Trend</Typography>
          </Stack>
          <PerformanceTrend data={student.performanceHistory} />
        </Paper>
      </Box>

      {/* Raw data + Courses */}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
  <RawDataTable rows={rawRows} />
  <CoursesList courses={student.courses} />
      </Box>
    </Stack>
  );
};

const ProfilePage: React.FC<{ student: ViewStudent }> = ({ student }) => (
  <Paper elevation={0} sx={{ p: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3 }}>
    <Typography variant="h5" fontWeight={700} mb={2}>My Profile</Typography>
    <Stack spacing={1.2}>
      <Typography variant="body2"><strong>ID:</strong> {student.id}</Typography>
      <Typography variant="body2"><strong>Code:</strong> {student.studentCode || '—'}</Typography>
      <Typography variant="body2"><strong>Name:</strong> {student.name}</Typography>
      <Typography variant="body2"><strong>Email:</strong> {student.email}</Typography>
      <Typography variant="body2"><strong>Program:</strong> {student.program || '—'}</Typography>
      <Typography variant="body2"><strong>Year:</strong> {student.year ?? '—'}</Typography>
      <Typography variant="body2"><strong>Risk:</strong> {student.risk.level} ({student.risk.score})</Typography>
      <Typography variant="body2"><strong>Last Updated:</strong> {student.lastRiskUpdated ? new Date(student.lastRiskUpdated).toLocaleString() : '—'}</Typography>
    </Stack>
  </Paper>
);

const SettingsPage: React.FC<{ dark: boolean; onToggleDark: () => void }> = ({ dark, onToggleDark }) => (
  <Stack spacing={4}>
    <Typography variant="h4" fontWeight={700}>Settings</Typography>
    <Paper elevation={0} sx={{ p: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h6" fontWeight={700}>Dark Mode</Typography>
          <Typography variant="body2" color="text.secondary">Toggle global appearance</Typography>
        </Box>
        <Switch checked={dark} onChange={onToggleDark} />
      </Stack>
    </Paper>
  </Stack>
);

interface StudentAppProps { logout: () => void; }

const StudentApp: React.FC<StudentAppProps> = ({ logout }) => {
  const { dark, toggleDark } = useDarkMode();
  const { session } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [page, setPage] = useState<'dashboard' | 'profile' | 'settings'>('dashboard');
  const [student, setStudent] = useState<ViewStudent | null>(null);
  const [attendanceSeries, setAttendanceSeries] = useState<{ month:string; pct:number }[]>(fallbackAttendanceHistory);
  const [interventions, setInterventions] = useState<{ date:string; text:string }[]>(fallbackInterventions);
  const [rawRows, setRawRows] = useState<{ type:string; when:string; value:string }[]>(fallbackRawRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSelf = useCallback(() => {
    if (!session?.token) return;
    setLoading(true); setError(null);
    Promise.all([
      fetch(`${API.studentMe}?_t=${Date.now()}`, { headers: { Authorization: `Bearer ${session.token}`, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }, cache: 'no-store' }).then(async r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); }),
      fetchMy360(session.token).catch(() => null)
    ])
      .then(([me, s360]) => {
        const s = me.student || me.data || me;
        // Prefer academics from 360 if present
        const att = s360?.academics?.attendancePercent;
        const cg = s360?.academics?.cgpa;
        const ac = s360?.academics?.assignmentsCompleted;
        const at = s360?.academics?.assignmentsTotal;
        const attendance = typeof att === 'number' ? Math.round(att) : 70;
        const gpa = typeof cg === 'number' ? cg : 2.5;
        const assignmentsSubmitted = (typeof ac === 'number' && typeof at === 'number' && at > 0) ? Math.round((ac / at) * 100) : 62;
        const lastExamScore = 55;
        const norm = normalizeRisk({ backendScore: s.riskScore, backendTier: s.riskTier, fallbackMetrics: { attendance, gpa, assignmentsSubmitted } });
        const history = (s360?.trend?.length ? s360!.trend.map((d: any, i: number) => ({ month: String(i+1), score: Math.round((1 - (d.score ?? 0)) * 100) })) : fallbackPerformanceHistory);
        const mappedRows = s360?.assignments?.slice(0,12)?.map((a: any) => ({ type: a.type || 'Assignment', when: a.when || a.date || new Date().toISOString(), value: (a.score != null ? String(a.score) : (a.status || '—')) })) || fallbackRawRows;
        const mappedInterventions = s360?.notes?.slice(0,12)?.map((n: any) => ({ date: n.createdAt || n.date || new Date().toISOString(), text: n.text || n.note || 'Note' })) || fallbackInterventions;
        // Attendance series: if we only have a single percentage, project a flat recent series
        const series = (() => {
          if (typeof att === 'number') {
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const now = new Date();
            const arr: { month:string; pct:number }[] = [];
            for (let i=5;i>=0;i--) {
              const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
              arr.push({ month: months[d.getMonth()], pct: Math.round(att) });
            }
            return arr;
          }
          return fallbackAttendanceHistory;
        })();
        // Courses: derive best-effort from subjects if available
        const mappedCourses = (() => {
          const subs = s360?.academics?.subjects;
          if (Array.isArray(subs) && subs.length) {
            return subs.slice(0,6).map((sub:any, idx:number) => ({ id: sub.id || `SUB-${idx+1}`, name: sub.name || sub.subject || 'Course', grade: sub.grade || (sub.score!=null? `${sub.score}` : '—') }));
          }
          return fallbackCourses;
        })();
        setStudent({
          id: s.id,
          name: s.name,
          email: s.email,
          attendance,
          gpa,
          assignmentsSubmitted,
          lastExamScore,
          performanceHistory: history,
          courses: mappedCourses,
          risk: { level: norm.level, score: norm.score ?? 0 },
          studentCode: s.studentCode,
          program: s.program ?? null,
          year: s.year ?? null,
          lastRiskUpdated: s.lastRiskUpdated ?? null,
          mentorId: s.mentorId ?? null
        });
        setRawRows(mappedRows);
        setInterventions(mappedInterventions);
        setAttendanceSeries(series);
      })
      .catch(e => setError(e.message))
      .finally(()=> setLoading(false));
  }, [session]);

  useEffect(() => { fetchSelf(); }, [fetchSelf]);
  // Refresh when tab becomes visible or cross-tab signal changes
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') fetchSelf(); };
    const onStorage = (e: StorageEvent) => { if (e.key === 'pk:last-students-update') fetchSelf(); };
    const onUpdated = () => fetchSelf();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('storage', onStorage);
    window.addEventListener('pk:students-updated', onUpdated as any);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pk:students-updated', onUpdated as any);
    };
  }, [fetchSelf]);
  // Gentle auto-refresh every 60s to reflect mentor/admin updates
  useEffect(() => {
    const id = setInterval(() => { fetchSelf(); }, 60000);
    return () => clearInterval(id);
  }, [fetchSelf]);

  if (!session) {
    return <Box sx={{ p:4 }}><Typography variant="h6" fontWeight={700}>Not authenticated</Typography></Box>;
  }
  // Role gate: must be viewer (student)
  const roleOk = (() => { try { const dec = JSON.parse(atob(session.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); return dec.role === 'viewer'; } catch { return false; } })();
  if (!roleOk) {
    return <Box sx={{ p:4 }}><Typography variant="h6" fontWeight={700}>Unauthorized</Typography><Typography variant="body2" color="text.secondary">Student account required.</Typography></Box>;
  }

  const renderPage = () => {
    if (!student) return null;
    switch (page) {
      case 'dashboard': return <DashboardPage student={student} attendanceSeries={attendanceSeries} interventions={interventions} rawRows={rawRows} />;
      case 'profile': return <ProfilePage student={student} />;
      case 'settings': return <SettingsPage dark={dark} onToggleDark={toggleDark} />;
      default: return null;
    }
  };

  const lastSync = useMemo(() => {
    if (!student?.lastRiskUpdated) return '—';
    try { return new Date(student.lastRiskUpdated).toLocaleString(); } catch { return '—'; }
  }, [student?.lastRiskUpdated]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Box sx={{ width: sidebarOpen ? 250 : 78, transition: 'width 240ms', borderRight: t => `1px solid ${t.palette.divider}`, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'space-between' : 'center' }}>
          {sidebarOpen && <Typography variant="h6" fontWeight={800}>Student</Typography>}
          <IconButton size="small" onClick={() => setSidebarOpen(o => !o)}><MenuIcon fontSize="small" /></IconButton>
        </Box>
        <Divider />
        <Stack spacing={0.5} sx={{ p: 1.2, flex: 1 }}>
          <NavBtn active={page === 'dashboard'} icon={<DashboardIcon fontSize="small" />} label="Dashboard" onClick={() => setPage('dashboard')} open={sidebarOpen} />
          <NavBtn active={page === 'profile'} icon={<PersonIcon fontSize="small" />} label="Profile" onClick={() => setPage('profile')} open={sidebarOpen} />
          <NavBtn active={page === 'settings'} icon={<SettingsIcon fontSize="small" />} label="Settings" onClick={() => setPage('settings')} open={sidebarOpen} />
        </Stack>
        <Divider />
        <Stack spacing={1.2} sx={{ p: 1.2 }}>
          <Button onClick={logout} startIcon={<LogoutIcon fontSize="small" />} size="small" variant="outlined" sx={{ justifyContent: sidebarOpen ? 'flex-start' : 'center', borderRadius: 2 }}>{sidebarOpen ? 'Logout' : 'Out'}</Button>
        </Stack>
      </Box>
      {/* Main */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Box sx={{ position: 'sticky', top: 0, zIndex: 5, backdropFilter: 'blur(12px)', bgcolor: t => t.palette.background.paper + 'CC', borderBottom: t => `1px solid ${t.palette.divider}`, px: 3, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1, maxWidth: sidebarOpen ? 320 : 260, position: 'relative' }}>
            <SearchIcon fontSize="small" style={{ position: 'absolute', top: 8, left: 8, opacity: 0.55 }} />
            <input placeholder="Search..." style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, outline: 'none', border: '1px solid rgba(0,0,0,0.2)', background: 'transparent', color: 'inherit' }} />
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ display:{ xs:'none', sm:'block' } }}>Last update: {lastSync}</Typography>
            <Button size="small" variant="outlined" onClick={fetchSelf} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'primary.contrastText' }}>{student ? student.name.charAt(0) : '?'}</Box>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                {student && <Typography variant="subtitle2" fontWeight={600} noWrap>{student.name}</Typography>}
                <Typography variant="caption" color="text.secondary" noWrap>Student</Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ flex: 1, px: { xs:2, md:3 }, py: { xs:2, md:3 }, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
          {loading && <Typography sx={{ p:2 }} variant="body2">Loading...</Typography>}
          {error && <Typography sx={{ p:2 }} color="error" variant="body2">{error}</Typography>}
          {student && renderPage()}
        </Box>
      </Box>
    </Box>
  );
};

const NavBtn: React.FC<{ active: boolean; icon: React.ReactNode; label: string; onClick: () => void; open: boolean; }> = ({ active, icon, label, onClick, open }) => (
  <Button onClick={onClick} startIcon={open ? icon : undefined} size="small" variant={active ? 'contained' : 'text'} fullWidth sx={{ justifyContent: open ? 'flex-start' : 'center', fontWeight: 600, borderRadius: 2, minHeight: 38 }}>{open ? label : icon}</Button>
);

export default StudentApp;
