import { StrictMode, useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import './index.css';
import Sidebar from './components/Sidebar';
import { DarkModeProvider } from './theme/DarkModeContext';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthCard } from './auth/AuthCard';
import { studentLogin, studentSignup, mentorLogin, mentorSignup, adminLogin, decodeJwt } from './auth/api';
import Overview from './pages/Overview';
import Settings from './pages/Settings';
import App from './App';
import Notifications from './pages/Notifications';
import { Box, Fab, Paper, Stack, Button } from '@mui/material';
import OverviewPage from './pages/OverviewPage';
import StudentImport from './pages/StudentImport';
import AdminApp from './admin/AdminApp';
import MentorApp from './mentor/MentorApp';
import StudentApp from './student/StudentApp';
import StudentActivate from './pages/StudentActivate';
import ThemeTransition from './theme/ThemeTransition';

function usePersistentState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* no-op */ }
  }, [key, val]);
  return [val, setVal];
}

function AuthScreen() {
  const { login } = useAuth();
  const [role, setRole] = useState('student'); // 'student' | 'mentor' | 'admin'
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(data){
    setLoading(true); setError(null);
    try {
      if (role==='student') {
        const resp = mode==='signup'? await studentSignup({ name: data.name || 'Student', email: data.email, password: data.password, studentCode: data.studentCode }) : await studentLogin({ email: data.email, password: data.password });
        const dec = decodeJwt(resp.token) || {};
        login({ token: resp.token, kind:'student', role: dec.role || dec.user?.role || 'student' });
        // ensure URL uses /student base after login
        try { window.history.replaceState(null,'','/student'); } catch {}
      } else if (role==='mentor') {
        const resp = mode==='signup'? await mentorSignup({ name: data.name || 'Mentor', email: data.email, password: data.password }) : await mentorLogin({ email: data.email, password: data.password });
        const dec = decodeJwt(resp.token) || {};
        const roleFromToken = dec.role || dec.user?.role || 'mentor';
        login({ token: resp.token, kind:'user', role: roleFromToken });
      } else if (role==='admin') {
        // Admin login only (no signup path via UI)
        const resp = await adminLogin({ email: data.email, password: data.password });
        const dec = decodeJwt(resp.token) || {};
        const roleFromToken = dec.role || dec.user?.role || 'admin';
        login({ token: resp.token, kind:'user', role: roleFromToken });
      }
    } catch(e){ setError(e.message || 'Auth failed'); }
    finally { setLoading(false); }
  }
  return (
  <Box sx={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', p:0, background:(t)=> t.palette.mode==='dark'? 'linear-gradient(145deg,#121212,#1e1e1e)' : 'linear-gradient(145deg,#e7ecf3,#f5f7fa)' }}>
      <Stack spacing={3} alignItems="center">
        <Stack direction="row" spacing={2}>
          <Button variant={role==='student'? 'contained':'outlined'} onClick={()=> setRole('student')} size="small">Student</Button>
          <Button variant={role==='mentor'? 'contained':'outlined'} onClick={()=> setRole('mentor')} size="small">Mentor</Button>
          <Button variant={role==='admin'? 'contained':'outlined'} onClick={()=> setRole('admin')} size="small">Admin</Button>
        </Stack>
        <AuthCard role={role} mode={mode} setMode={setMode} loading={loading} error={error} onSubmit={handleSubmit} allowMentorSignup={false} />
      </Stack>
    </Box>
  );
}

function Shell() {
  const [dark, setDark] = usePersistentState('pk.dark', false);
  const [navOpen, setNavOpen] = usePersistentState('pk.navOpen', true);
  const theme = useMemo(() => {
    if (dark) {
      // Exact dark theme colors requested
      const COLOR_BG = '#1A1A1A';          // Near-Black base
      const COLOR_SURFACE = '#2C2C2C';     // Dark Charcoal surface
      const COLOR_TEXT = '#E0E0E0';        // Light Grey (primary text)
      const COLOR_TEXT_SECONDARY = '#BDBDBD';
      const COLOR_ACCENT = '#B85C4F';      // Terracotta Red accent
      const background = { default: COLOR_BG, paper: COLOR_SURFACE };
      return createTheme({
        palette: {
          mode: 'dark',
            primary: { main: COLOR_ACCENT, contrastText: COLOR_TEXT },
            secondary: { main: '#D07A6E' },
            background,
            text: { primary: COLOR_TEXT, secondary: COLOR_TEXT_SECONDARY },
            divider: '#3a3a3a'
        },
        typography: {
          fontFamily: 'Poppins, Roboto, Helvetica, Arial, sans-serif'
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              ':root': {
                '--pk-bg': COLOR_BG,
                '--pk-surface': COLOR_SURFACE,
                '--pk-text': COLOR_TEXT,
                '--pk-text-secondary': COLOR_TEXT_SECONDARY,
                '--pk-accent': COLOR_ACCENT,
              },
              body: {
                backgroundColor: COLOR_BG,
                color: COLOR_TEXT,
                WebkitFontSmoothing: 'antialiased',
              },
              '::-webkit-scrollbar': { width: '8px' },
              '::-webkit-scrollbar-thumb': { background: '#444', borderRadius: 4 },
              '::-webkit-scrollbar-track': { background: '#1f1f1f' },
            }
          },
          MuiPaper: {
            styleOverrides: { root: { backgroundColor: COLOR_SURFACE } }
          },
          MuiAppBar: {
            styleOverrides: { root: { backgroundImage: 'none', backgroundColor: COLOR_SURFACE, color: COLOR_TEXT } }
          },
          MuiTooltip: {
            styleOverrides: { tooltip: { backgroundColor: '#222', color: COLOR_TEXT, fontSize: '0.7rem' } }
          },
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 8,
                '&.MuiButton-containedPrimary': { boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }
              }
            }
          },
          MuiIconButton: {
            styleOverrides: { root: { borderRadius: 10 } }
          },
          MuiChip: {
            styleOverrides: { root: { fontWeight: 500 } }
          }
        }
      });
    } else {
      // Light mode: Calm Green and Neutral (forest green, off-white, slate blue)
      const background = { default: '#F7F7F5', paper: '#FFFFFF' };
      const text = { primary: '#1F2937', secondary: '#475569' };
      return createTheme({
        palette: {
          mode: 'light',
          primary: { main: '#2E7D32' }, // Forest Green
          secondary: { main: '#5B7C99' }, // Slate Blue
          background,
          text,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundColor: background.default,
                color: text.primary,
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundColor: background.paper,
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                backgroundColor: '#FFFFFF',
                color: text.primary,
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: { textTransform: 'none', fontWeight: 600 },
            },
          },
        },
      });
    }
  }, [dark]);
  // Reference to App component to trigger reload
  const appRef = useRef(null);
  // Helper to reload students in App
  const reloadStudents = () => {
    if (appRef.current && appRef.current.reloadStudents) {
      appRef.current.reloadStudents();
    }
  };
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (!session) return <AuthScreen />;

  // mentor redirect
  if (session.role === 'mentor' && !location.pathname.startsWith('/mentor')) {
    navigate('/mentor', { replace: true });
  }
  // admin redirect
  if (session.role === 'admin' && !location.pathname.startsWith('/admin')) {
    navigate('/admin', { replace: true });
  }
  // student redirect (use /student prefix now)
  if (session.kind === 'student' && !location.pathname.startsWith('/student')) {
    navigate('/student', { replace: true });
  }

  if (session.kind === 'student') {
    return (
      <DarkModeProvider value={{ dark, toggleDark: () => setDark(v=>!v), setDark }}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <ThemeTransition />
          {/* student now nested under /student/* route, keep direct for fallback */}
          <StudentApp logout={logout} />
        </ThemeProvider>
      </DarkModeProvider>
    );
  }
  // Determine if path uses embedded nav
  const usingEmbeddedNav = location.pathname.startsWith('/mentor') || location.pathname.startsWith('/admin');
  return (
    <DarkModeProvider value={{ dark, toggleDark: () => setDark(v=>!v), setDark }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ThemeTransition />
        <Box sx={{ minHeight: '100vh' }}>
  {!usingEmbeddedNav && <Sidebar open={navOpen} onToggle={(v)=> setNavOpen(v)} />}
        {/* floating hamburger removed per UX request */}
  <Box sx={{ pl: usingEmbeddedNav ? 0 : { xs:0, sm: navOpen ? '305px' : '95px' }, pr: 0, pt: 0, pb: 0, transition: 'padding-left 250ms ease' }}>
          <Routes>
            <Route path="/" element={<Overview appRef={appRef} navOpen={navOpen} />} />
            {/* student scoped route */}
            <Route path="/student/*" element={<StudentApp logout={logout} />} />
            <Route path="/activate" element={<StudentActivate />} />
            <Route path="/new-overview" element={<OverviewPage />} />
            <Route path="/settings" element={<Settings dark={dark} onToggleDark={() => setDark(v => !v)} reloadStudents={reloadStudents} />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/import" element={<StudentImport />} />
            <Route path="/admin/*" element={<AdminApp />} />
            <Route path="/mentor/*" element={<MentorApp />} />
          </Routes>
        </Box>
        </Box>
      </ThemeProvider>
    </DarkModeProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
