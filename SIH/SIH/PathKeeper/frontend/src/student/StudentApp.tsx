import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { normalizeRisk, syntheticRiskFromMetrics } from '../risk/riskUtil';
import { useDarkMode } from '../theme/DarkModeContext';
import { Box, Stack, Typography, Paper, IconButton, Button, Divider, Chip, Switch } from '@mui/material';
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

// Synthetic fallbacks (performance history & courses) until backend provides richer student metrics
const fallbackPerformanceHistory = [
  { month: 'Jan', score: 60 }, { month: 'Feb', score: 55 }, { month: 'Mar', score: 62 },
  { month: 'Apr', score: 55 }, { month: 'May', score: 58 }, { month: 'Jun', score: 52 }
];
const fallbackCourses = [
  { id: 'C101', name: 'Introduction to Physics', grade: 'C' },
  { id: 'C102', name: 'Calculus I', grade: 'B' },
  { id: 'C103', name: 'English Composition', grade: 'B' },
  { id: 'C104', name: 'Data Structures', grade: 'C+' }
];

// Shared StatCard imported

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

interface ViewStudent { id: string; name: string; email: string; attendance: number; gpa: number; assignmentsSubmitted: number; lastExamScore: number; performanceHistory: { month: string; score: number }[]; courses: { id: string; name: string; grade: string }[]; risk: { level: string; score: number } }

const DashboardPage: React.FC<{ student: ViewStudent }> = ({ student }) => (
  <Stack spacing={4}>
    <Typography variant="h4" fontWeight={700}>Welcome back, {student.name.split(' ')[0]}!</Typography>
    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(2,1fr)', lg: 'repeat(4,1fr)' } }}>
      <StatCard title="Overall GPA" value={student.gpa.toFixed(1)} change="Keep it up!" icon={<TrendingUpIcon fontSize="small" />} />
      <StatCard title="Attendance" value={`${student.attendance}%`} change="Aim for 90%+" icon={<Groups2Icon fontSize="small" />} />
      <StatCard title="Assignments" value={`${student.assignmentsSubmitted}%`} change="Submitted" icon={<TaskAltIcon fontSize="small" />} />
      <StatCard title="Courses" value={student.courses.length} change="Enrolled" icon={<SchoolIcon fontSize="small" />} />
    </Box>
    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
      <CoursesList courses={student.courses} />
      <Paper elevation={0} sx={{ p: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" fontWeight={700}>My Performance Trend</Typography>
          <RiskBadge tier={student.risk.level as any} />
        </Stack>
        <PerformanceTrend data={student.performanceHistory} />
      </Paper>
    </Box>
  </Stack>
);

const ProfilePage: React.FC<{ student: ViewStudent }> = ({ student }) => (
  <Paper elevation={0} sx={{ p: 3, border: t => `1px solid ${t.palette.divider}`, borderRadius: 3 }}>
    <Typography variant="h5" fontWeight={700} mb={2}>My Profile</Typography>
    <Stack spacing={1.2}>
      <Typography variant="body2"><strong>ID:</strong> {student.id}</Typography>
      <Typography variant="body2"><strong>Name:</strong> {student.name}</Typography>
      <Typography variant="body2"><strong>Email:</strong> {student.email}</Typography>
      <Typography variant="body2"><strong>Risk:</strong> {student.risk.level} ({student.risk.score})</Typography>
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

import { useAuth } from '../auth/AuthContext';
import { API } from '../api';

interface StudentAppProps { logout: () => void; }

const StudentApp: React.FC<StudentAppProps> = ({ logout }) => {
  const { dark, toggleDark } = useDarkMode();
  const { session } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [page, setPage] = useState<'dashboard' | 'profile' | 'settings'>('dashboard');
  const [student, setStudent] = useState<ViewStudent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSelf = useCallback(() => {
    if (!session?.token) return;
    setLoading(true); setError(null);
    fetch(API.studentMe, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then(json => {
        const s = json.student || json.data || json;
        const attendance = 70; // placeholder until real fields exist
        const gpa = 2.5; // placeholder
        const assignmentsSubmitted = 62; // placeholder
        const lastExamScore = 55; // placeholder
        const norm = normalizeRisk({ backendScore: s.riskScore, backendTier: s.riskTier, fallbackMetrics: { attendance, gpa, assignmentsSubmitted } });
        setStudent({
          id: s.id,
          name: s.name,
            email: s.email,
          attendance,
          gpa,
          assignmentsSubmitted,
          lastExamScore,
          performanceHistory: fallbackPerformanceHistory,
          courses: fallbackCourses,
          risk: { level: norm.level, score: norm.score ?? 0 }
        });
      })
      .catch(e => setError(e.message))
      .finally(()=> setLoading(false));
  }, [session]);

  useEffect(() => { fetchSelf(); }, [fetchSelf]);

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
      case 'dashboard': return <DashboardPage student={student} />;
      case 'profile': return <ProfilePage student={student} />;
      case 'settings': return <SettingsPage dark={dark} onToggleDark={toggleDark} />;
      default: return null;
    }
  };

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
