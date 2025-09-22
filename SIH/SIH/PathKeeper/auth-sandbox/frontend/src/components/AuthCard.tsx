import React from 'react';
// Using public path reference for logo; Vite serves /public at root.
import { Box, Typography, TextField, InputAdornment, IconButton, Button, Fade, Alert, LinearProgress, Tooltip, CircularProgress } from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

export interface AuthCardProps {
  role: 'student' | 'mentor';
  mode: 'login' | 'signup';
  loading: boolean;
  error?: string | null;
  onSubmit: (data: { name?: string; email: string; password: string; studentCode?: string }) => void;
  allowMentorSignup: boolean;
  setMode?: (mode: 'login' | 'signup') => void;
}

export const AuthCard: React.FC<AuthCardProps> = ({ role, mode, loading, error, onSubmit, allowMentorSignup, setMode }) => {
  const [showPass, setShowPass] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [studentCode, setStudentCode] = React.useState('');
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passScore, setPassScore] = React.useState(0); // 0-4
  const [confirm, setConfirm] = React.useState('');
  const [confirmError, setConfirmError] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(false);

  // Simple password strength heuristic
  React.useEffect(()=> {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    setPassScore(score);
  }, [password]);

  const validateEmail = (val: string) => {
    if (!val) return 'Email required';
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    return ok ? null : 'Invalid email';
  };

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    const emErr = validateEmail(email);
    setEmailError(emErr);
    const cErr = (mode==='signup') && password !== confirm ? 'Passwords do not match' : null;
    setConfirmError(cErr);
    if (emErr || cErr) {
      setShake(true);
      setTimeout(()=> setShake(false), 550);
      return;
    }
    onSubmit({ name: name || undefined, email, password, studentCode: studentCode || undefined });
  };

  const isStudent = role === 'student';
  const title = mode === 'login' ? `Login as ${isStudent ? 'Student':'Mentor'}` : `Sign up as ${isStudent ? 'Student':'Mentor'}`;

  return (
    <Fade in timeout={400}>
      <Box component="form" onSubmit={handle} sx={{
        width: 380,
        display:'flex', flexDirection:'column', gap:2.2,
        background: (t)=> t.palette.mode==='dark' ? 'linear-gradient(145deg,#262626,#1d1d1d)' : 'linear-gradient(145deg,#ffffff,#f3f5f7)',
        borderRadius: 5,
        p: 4,
        pt: 5,
        boxShadow: (t)=> t.palette.mode==='dark' ? '0 8px 28px -8px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.4)' : '0 8px 26px -6px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)',
        position:'relative',
        animation: shake ? 'pk-shake 0.55s ease' : 'none'
      }}>
        <style>{`@keyframes pk-shake {10%, 90% {transform: translateX(-2px);} 20%, 80% {transform: translateX(4px);} 30%, 50%, 70% {transform: translateX(-6px);} 40%, 60% {transform: translateX(6px);} }`}</style>
        <Typography variant="h5" sx={{ fontWeight:700, textAlign:'center', mb:0.5 }}>{title}</Typography>
        {mode==='signup' && (
          <TextField label="Full Name" value={name} onChange={e=>setName(e.target.value)} fullWidth size="small" />
        )}
        {isStudent && mode==='signup' && (
          <TextField label="Student Code (optional)" value={studentCode} onChange={e=>setStudentCode(e.target.value)} fullWidth size="small" />
        )}
        <TextField label="Email" value={email} onChange={e=> { setEmail(e.target.value); if (emailError) setEmailError(validateEmail(e.target.value)); }} fullWidth size="small"
          error={!!emailError}
          helperText={emailError || ' '}
          InputProps={{ startAdornment: <InputAdornment position="start"><MailOutlineIcon fontSize="small" /></InputAdornment> }} />
        <Tooltip placement="top" arrow title={mode==='signup' ? 'Min 8 chars, include uppercase, number & symbol for strong rating.' : ''}>
          <TextField label="Password" type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} fullWidth size="small"
          InputProps={{ startAdornment: <InputAdornment position="start"><LockOutlinedIcon fontSize="small" /></InputAdornment>,
            endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={()=>setShowPass(p=>!p)}>{showPass? <VisibilityOff fontSize="small" />:<Visibility fontSize="small" />}</IconButton></InputAdornment> }} />
        </Tooltip>
        {password && (
          <Box sx={{ mt:-1.5 }}>
            <LinearProgress variant="determinate" value={(passScore/4)*100} sx={{ height:6, borderRadius:3, bgcolor:(t)=> t.palette.mode==='dark'? '#333':'#e5e8ea', '& .MuiLinearProgress-bar': { transition:'0.3s', backgroundColor: passScore>=3? '#2E7D32' : passScore===2? '#F9A825' : '#D32F2F' } }} />
            <Typography variant="caption" sx={{ display:'block', textAlign:'right', mt:0.4, color:(passScore>=3? 'success.main' : passScore===2? 'warning.main':'error.main') }}>
              {passScore>=3? 'Strong' : passScore===2? 'Medium':'Weak'}
            </Typography>
          </Box>
        )}
        {mode==='signup' && (
          <TextField label="Confirm Password" type={showPass?'text':'password'} value={confirm} onChange={e=> { setConfirm(e.target.value); if (confirmError) setConfirmError(e.target.value === password ? null : 'Passwords do not match'); }} fullWidth size="small" error={!!confirmError} helperText={confirmError || ' '} />
        )}
        {error && <Alert severity="error" variant="outlined" sx={{ mt: -0.5 }}>{error}</Alert>}
        <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ py:1.2, fontWeight:700, position:'relative' }}>{loading? <><CircularProgress size={20} sx={{ mr:1, color:'inherit' }} /> Processing…</> : (mode==='login'? 'Login':'Create Account')}</Button>
        {role==='mentor' && mode==='signup' && !allowMentorSignup && (
          <Alert severity="warning" variant="standard" sx={{ fontSize:12 }}>Mentor signup disabled.</Alert>
        )}
        <Box sx={{ mt:-0.5, textAlign:'center' }}>
          {mode==='login' ? (
            <Typography variant="caption" sx={{ fontSize:12 }}>
              Don't have an account?{' '}
              <Button type="button" size="small" variant="text" onClick={()=> setMode?.('signup')} sx={{ textTransform:'none', fontWeight:600, ml:0.5 }}>Sign up</Button>
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ fontSize:12 }}>
              Already have an account?{' '}
              <Button type="button" size="small" variant="text" onClick={()=> setMode?.('login')} sx={{ textTransform:'none', fontWeight:600, ml:0.5 }}>Login</Button>
            </Typography>
          )}
        </Box>
        {loading && (
          <Box sx={{ position:'absolute', inset:0, borderRadius:5, bgcolor:'rgba(255,255,255,0.55)', backdropFilter:'blur(2px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2, '& .dark &': { bgcolor:'rgba(0,0,0,0.4)' } }}>
            <CircularProgress size={48} thickness={4} />
          </Box>
        )}
      </Box>
    </Fade>
  );
};
