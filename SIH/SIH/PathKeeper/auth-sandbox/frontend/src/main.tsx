import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline, Box, ToggleButtonGroup, ToggleButton, Stack, Typography, Link } from '@mui/material';
import { buildTheme } from './theme';
import { AuthCard } from './components/AuthCard';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { scheduleLogout, isExpired, msUntilExpiry } from './authSession';
import { studentSignup, studentLogin, teacherLogin, teacherSignup } from './api';

interface SessionState { token: string; principalType: 'student'|'teacher'; }

const App: React.FC = () => {
  const [dark] = React.useState(false); // dark toggle removed per requirements (controlled elsewhere later)
  const [role, setRole] = React.useState<'student'|'mentor'>('student');
  const [mode, setMode] = React.useState<'login'|'signup'>('login');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string|null>(null);
  const [session, setSession] = React.useState<SessionState | null>(null);
  const allowMentorSignup = false; // matches backend default

  const theme = React.useMemo(()=> buildTheme(dark), [dark]);

  // Track scheduled logout handle
  const logoutRef = React.useRef<{ cancel: () => void } | null>(null);

  // Whenever session changes, schedule auto logout
  React.useEffect(()=> {
    logoutRef.current?.cancel();
    if (session) {
      if (isExpired(session.token)) { setSession(null); return; }
      logoutRef.current = scheduleLogout(session.token, () => {
        console.info('[auth] token expired, clearing session');
        setSession(null);
      });
    }
    return ()=> { logoutRef.current?.cancel(); };
  }, [session]);

  // Visibility change: if user returns after being away, re-check expiry
  React.useEffect(()=> {
    const handler = () => {
      if (session && isExpired(session.token)) {
        setSession(null);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return ()=> document.removeEventListener('visibilitychange', handler);
  }, [session]);

  // Optional remaining time display (could be surfaced later)
  const remainingMs = session ? msUntilExpiry(session.token) : null;

  const handleSubmit = async (data: { name?: string; email: string; password: string; studentCode?: string }) => {
    setLoading(true); setError(null);
    try {
      if (role === 'student') {
        const resp = mode==='signup' ? await studentSignup({ name: data.name || 'Student', email: data.email, password: data.password, studentCode: data.studentCode }) : await studentLogin({ email: data.email, password: data.password });
        setSession({ token: resp.token, principalType:'student' });
      } else { // mentor path uses teacher endpoints
        if (mode==='signup') {
          const resp = await teacherSignup({ name: data.name || 'Mentor', email: data.email, password: data.password });
          setSession({ token: resp.token, principalType:'teacher' });
        } else {
          const resp = await teacherLogin({ email: data.email, password: data.password });
          setSession({ token: resp.token, principalType:'teacher' });
        }
      }
    } catch (e:any) {
      setError(e.message || 'Auth failed');
    } finally {
      setLoading(false);
    }
  };

  if (session && session.principalType === 'student') {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight:'100vh', background:(t)=> t.palette.mode==='dark'? 'linear-gradient(145deg,#161616,#222)' : 'linear-gradient(145deg,#f0f2f5,#ffffff)', overflow:'auto' }}>
          <StudentDashboard onLogout={()=> setSession(null)} />
        </Box>
      </ThemeProvider>
    );
  }

  if (session && session.principalType === 'teacher') {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight:'100vh', background:(t)=> t.palette.mode==='dark'? 'linear-gradient(145deg,#161616,#222)' : 'linear-gradient(145deg,#f0f2f5,#ffffff)', overflow:'auto' }}>
          <TeacherDashboard token={session.token} onLogout={()=> setSession(null)} />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', p:2, background:(t)=> t.palette.mode==='dark'? 'linear-gradient(145deg,#121212,#1e1e1e)' : 'linear-gradient(145deg,#e7ecf3,#f5f7fa)' }}>
        <Stack spacing={3} alignItems="center">
          <ToggleButtonGroup exclusive value={role} onChange={(_,v)=> v && setRole(v)} size="small" color="primary" sx={{ mb:1 }}>
            <ToggleButton value="student">Student</ToggleButton>
            <ToggleButton value="mentor">Mentor</ToggleButton>
          </ToggleButtonGroup>
          <AuthCard role={role} mode={mode} loading={loading} error={error} onSubmit={handleSubmit} allowMentorSignup={allowMentorSignup} setMode={setMode} />
        </Stack>
      </Box>
    </ThemeProvider>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
