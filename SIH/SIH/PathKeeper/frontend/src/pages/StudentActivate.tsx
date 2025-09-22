import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, TextField, Stack, Button, Alert } from '@mui/material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../api';

async function getInviteInfo(token: string) {
  const r = await fetch(`${API_BASE.replace(/\/$/,'')}/signup/student/verify/${token}`);
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || 'Invalid token');
  return j.student as { name:string; email:string; studentCode:string };
}
async function completeSignup(payload: any) {
  const r = await fetch(`${API_BASE.replace(/\/$/,'')}/signup/student/complete`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || 'Activation failed');
  return j;
}

const StudentActivate: React.FC = () => {
  const [sp] = useSearchParams();
  const token = sp.get('token') || '';
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [info, setInfo] = useState<{ name:string; email:string; studentCode:string }|null>(null);
  const [pwd, setPwd] = useState('');
  const [profile, setProfile] = useState({ phone:'', guardianName:'', guardianEmail:'', guardianPhone:'', terms:false });
  const weak = pwd.length>0 && pwd.length<8;
  useEffect(()=> {
    if (!token) { setError('Missing token'); setLoading(false); return; }
    getInviteInfo(token).then(setInfo).catch(e=> setError(e.message)).finally(()=> setLoading(false));
  }, [token]);
  const canSubmit = !!info && !weak && pwd.length>=8 && profile.terms;
  const submit = async ()=> {
    if (!canSubmit) return;
    try {
      setLoading(true); setError(null);
      await completeSignup({ token, password: pwd, phone: profile.phone||undefined, guardianName: profile.guardianName||undefined, guardianEmail: profile.guardianEmail||undefined, guardianPhone: profile.guardianPhone||undefined });
      nav('/?activated=1');
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  };
  return (
    <Box sx={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', p:2 }}>
      <Paper sx={{ p:4, width: 540, maxWidth:'100%', display:'flex', flexDirection:'column', gap:2 }}>
        <Typography variant="h5" fontWeight={700}>Student Account Activation</Typography>
        {!info && loading && <Typography variant="body2">Loading...</Typography>}
        {error && <Alert severity="error" onClose={()=> setError(null)}>{error}</Alert>}
        {info && (
          <Stack spacing={2}>
            <TextField label="Student Code" value={info.studentCode} disabled fullWidth />
            <TextField label="Name" value={info.name} disabled fullWidth />
            <TextField label="Email" value={info.email} disabled fullWidth />
            <TextField label="Password" type="password" value={pwd} error={weak} helperText={weak? 'Min 8 chars':''} onChange={e=> setPwd(e.target.value)} fullWidth />
            <TextField label="Phone" value={profile.phone} onChange={e=> setProfile(p=> ({ ...p, phone: e.target.value }))} fullWidth />
            <Typography variant="subtitle2">Guardian (Optional)</Typography>
            <TextField label="Guardian Name" value={profile.guardianName} onChange={e=> setProfile(p=> ({ ...p, guardianName: e.target.value }))} fullWidth />
            <TextField label="Guardian Email" value={profile.guardianEmail} onChange={e=> setProfile(p=> ({ ...p, guardianEmail: e.target.value }))} fullWidth />
            <TextField label="Guardian Phone" value={profile.guardianPhone} onChange={e=> setProfile(p=> ({ ...p, guardianPhone: e.target.value }))} fullWidth />
            <Stack direction="row" spacing={1} alignItems="center">
              <input id="terms" type="checkbox" checked={profile.terms} onChange={e=> setProfile(p=> ({ ...p, terms: e.target.checked }))} />
              <label htmlFor="terms" style={{ fontSize:12 }}>I agree to the Terms of Service</label>
            </Stack>
            <Button variant="contained" disabled={!canSubmit || loading} onClick={submit}>{loading? 'Submitting...':'Activate Account'}</Button>
          </Stack>
        )}
      </Paper>
    </Box>
  );
};
export default StudentActivate;
