import React from 'react';
import { Box, Typography, TextField, InputAdornment, IconButton, Button, LinearProgress, Tooltip, Alert } from '@mui/material';
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
  setMode: (m: 'login' | 'signup') => void;
}

export const AuthCard: React.FC<AuthCardProps> = ({ role, mode, loading, error, onSubmit, allowMentorSignup, setMode }) => {
  const [showPass, setShowPass] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [studentCode, setStudentCode] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [emailErr, setEmailErr] = React.useState<string | null>(null);
  const [confirmErr, setConfirmErr] = React.useState<string | null>(null);
  const [score, setScore] = React.useState(0);

  React.useEffect(()=> {
    let s=0; if(password.length>=8) s++; if(/[A-Z]/.test(password)) s++; if(/[0-9]/.test(password)) s++; if(/[^A-Za-z0-9]/.test(password)) s++; setScore(s);
  }, [password]);

  const validateEmail=(v:string)=> /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Invalid email';

  function submit(e: React.FormEvent){
    e.preventDefault();
    const em = validateEmail(email); setEmailErr(em);
    const ce = mode==='signup' && password!==confirm ? 'Passwords do not match': null; setConfirmErr(ce);
    if (em || ce) return;
    onSubmit({ name: name||undefined, email, password, studentCode: studentCode||undefined });
  }

  const isStudent = role==='student';
  const title = mode==='login'? `Login as ${isStudent? 'Student':'Mentor'}` : `Sign up as ${isStudent? 'Student':'Mentor'}`;

  return (
    <Box component="form" onSubmit={submit} sx={{ width:380, display:'flex', flexDirection:'column', gap:2.2, p:4, pt:5, borderRadius:5, background:(t)=> t.palette.mode==='dark'? '#222':'linear-gradient(145deg,#ffffff,#f3f5f7)', boxShadow:(t)=> t.palette.mode==='dark'? '0 8px 24px -6px rgba(0,0,0,0.8)':'0 8px 24px -6px rgba(0,0,0,0.15)' }}>
      <Typography variant="h5" sx={{ fontWeight:700, textAlign:'center' }}>{title}</Typography>
      {mode==='signup' && (
        <TextField label="Full Name" size="small" value={name} onChange={e=>setName(e.target.value)} fullWidth />
      )}
      {isStudent && mode==='signup' && (
        <TextField label="Student Code (optional)" size="small" value={studentCode} onChange={e=>setStudentCode(e.target.value)} fullWidth />
      )}
      <TextField label="Email" size="small" value={email} onChange={e=> { setEmail(e.target.value); if(emailErr) setEmailErr(validateEmail(e.target.value)); }} error={!!emailErr} helperText={emailErr||' '} fullWidth InputProps={{ startAdornment:<InputAdornment position="start"><MailOutlineIcon fontSize="small" /></InputAdornment> }} />
      <Tooltip title={mode==='signup' ? 'Min 8 chars, uppercase, number & symbol recommended' : ''} placement="top" arrow>
        <TextField label="Password" size="small" type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} fullWidth InputProps={{ startAdornment:<InputAdornment position="start"><LockOutlinedIcon fontSize="small" /></InputAdornment>, endAdornment:<InputAdornment position="end"><IconButton size="small" onClick={()=>setShowPass(p=>!p)}>{showPass? <VisibilityOff fontSize="small" />:<Visibility fontSize="small" />}</IconButton></InputAdornment> }} />
      </Tooltip>
      {password && (
        <Box sx={{ mt:-1.5 }}>
          <LinearProgress variant="determinate" value={(score/4)*100} sx={{ height:6, borderRadius:3, bgcolor:(t)=> t.palette.mode==='dark'? '#333':'#e5e8ea', '& .MuiLinearProgress-bar':{ backgroundColor: score>=3? '#2E7D32': score===2? '#F9A825':'#D32F2F' } }} />
          <Typography variant="caption" sx={{ display:'block', textAlign:'right', mt:0.4, color: score>=3? 'success.main': score===2? 'warning.main':'error.main' }}>{score>=3? 'Strong': score===2? 'Medium':'Weak'}</Typography>
        </Box>
      )}
      {mode==='signup' && (
        <TextField label="Confirm Password" size="small" type={showPass?'text':'password'} value={confirm} onChange={e=> { setConfirm(e.target.value); if(confirmErr) setConfirmErr(e.target.value===password? null : 'Passwords do not match'); }} error={!!confirmErr} helperText={confirmErr||' '} fullWidth />
      )}
      {error && <Alert severity="error" variant="outlined" sx={{ mt:-0.5 }}>{error}</Alert>}
      <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ py:1.2, fontWeight:700 }}>{loading? (mode==='login'? 'Logging in...' : 'Creating...') : (mode==='login'? 'Login':'Create Account')}</Button>
      {role==='mentor' && mode==='signup' && !allowMentorSignup && (
        <Alert severity="warning" variant="standard" sx={{ fontSize:12 }}>Mentor signup disabled.</Alert>
      )}
      <Box sx={{ textAlign:'center', mt:-0.5 }}>
        {mode==='login' ? (
          <Typography variant="caption">Don't have an account? <Button size="small" variant="text" onClick={()=> setMode('signup')} sx={{ textTransform:'none', fontWeight:600 }}>Sign up</Button></Typography>
        ) : (
          <Typography variant="caption">Already have an account? <Button size="small" variant="text" onClick={()=> setMode('login')} sx={{ textTransform:'none', fontWeight:600 }}>Login</Button></Typography>
        )}
      </Box>
    </Box>
  );
};
