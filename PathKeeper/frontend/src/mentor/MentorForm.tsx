import React, { useEffect, useState } from 'react';
import { Box, Button, TextField, Stack, Typography, Paper, Grid } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../api';

const endpoint = `${API_BASE}/mentor-form`;

const MentorForm: React.FC = () => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<any>({
    fullName: '',
    department: '',
    expertise: '',
    experienceYears: '',
    maxMentees: '',
    availability: '',
    contactPreference: '',
    bio: '',
    linkedIn: '',
    officeLocation: ''
  });

  useEffect(() => {
    if (!session) return;
    const token = session.token;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const mentorId = payload.sub || payload.id;
      // fetch existing
      fetch(`${endpoint}/${mentorId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => { if (!r.ok) throw new Error('no form'); return r.json(); })
        .then(j => { setForm(prev => ({ ...prev, ...j.data })); setSaved(true); })
        .catch(() => {})
    } catch (e) { /* ignore */ }
  }, [session]);

  const change = (k: string, v: any) => setForm((p:any) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!session) return;
    setLoading(true);
    const token = session.token;
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
    if (!res.ok) { alert('Save failed'); setLoading(false); return; }
    setSaved(true); setLoading(false);
    alert('Form saved');
  };

  return (
    <Paper elevation={0} sx={{ p:3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>Mentor Profile Form</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Please fill out your profile details. This information will be visible to your assigned mentees.
      </Typography>
      <Stack spacing={2}>
        <Stack direction={{ xs:'column', md:'row' }} spacing={2}>
          <TextField fullWidth label="Full Name" value={form.fullName} onChange={e=>change('fullName', e.target.value)} />
          <TextField fullWidth label="Department" value={form.department} onChange={e=>change('department', e.target.value)} />
        </Stack>
        <TextField fullWidth label="Expertise / Domain" value={form.expertise} onChange={e=>change('expertise', e.target.value)} placeholder="e.g. AI/ML, Web Dev, Embedded Systems" />
        <Stack direction={{ xs:'column', md:'row' }} spacing={2}>
          <TextField fullWidth label="Experience (Years)" value={form.experienceYears} onChange={e=>change('experienceYears', e.target.value)} type="number" />
          <TextField fullWidth label="Max Mentees Capacity" value={form.maxMentees} onChange={e=>change('maxMentees', e.target.value)} type="number" />
        </Stack>
        <TextField fullWidth label="Availability (Days/Times)" value={form.availability} onChange={e=>change('availability', e.target.value)} placeholder="e.g. Mon/Wed 2-4 PM" />
        <Stack direction={{ xs:'column', md:'row' }} spacing={2}>
          <TextField fullWidth label="Contact Preference" value={form.contactPreference} onChange={e=>change('contactPreference', e.target.value)} placeholder="Email, Slack, WhatsApp" />
          <TextField fullWidth label="Office Location" value={form.officeLocation} onChange={e=>change('officeLocation', e.target.value)} />
        </Stack>
        <TextField fullWidth label="LinkedIn / Profile URL" value={form.linkedIn} onChange={e=>change('linkedIn', e.target.value)} />
        <TextField fullWidth label="Bio / About Me" value={form.bio} onChange={e=>change('bio', e.target.value)} multiline minRows={4} />
      </Stack>
      <Box mt={3}>
        <Button variant="contained" onClick={submit} disabled={loading}>{loading ? 'Saving…' : 'Save Profile'}</Button>
      </Box>
    </Paper>
  )
}

export default MentorForm;
