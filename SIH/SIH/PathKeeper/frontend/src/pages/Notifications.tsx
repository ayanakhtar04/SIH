import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Stack, Chip, CircularProgress } from '@mui/material';
import { API } from '../api';

interface NotificationLog { id?:string; channel?:string; createdAt?:string; type?:string; preview?:string; status?:string; }

const Notifications: React.FC = () => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();

  useEffect(()=> {
    let active = true;
    async function load() {
      setLoading(true); setError(undefined);
      try {
        const r = await fetch(`${API.notifications}/logs?limit=50`);
        if(!r.ok) throw new Error(`Status ${r.status}`);
        const j = await r.json();
        if (!active) return;
        const items = j.logs || j.data || [];
        setLogs(items);
      } catch(e:any) {
        if (active) setError(e.message || 'Failed loading notifications');
      } finally { if (active) setLoading(false); }
    }
    load();
    return ()=> { active = false; };
  }, []);

  return (
    <Box sx={{ p: 3, display:'flex', flexDirection:'column', gap:2 }}>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>Notifications</Typography>
      {loading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography variant="caption">Loading…</Typography></Stack>}
      {error && <Typography variant="caption" color="error">{error}</Typography>}
      {!loading && !error && logs.length===0 && <Typography variant="body2" color="text.secondary">No notifications yet.</Typography>}
      <Stack spacing={1.5}>
        {logs.map((n,i)=> (
          <Paper key={n.id || i} variant="outlined" sx={{ p:1.2, display:'flex', flexDirection:'column', gap:0.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2" fontWeight={600}>{n.type || n.channel || 'Notification'}</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {n.status && <Chip size="small" label={n.status} />}
                {n.channel && <Chip size="small" variant="outlined" label={n.channel} />}
              </Stack>
            </Stack>
            {n.preview && <Typography variant="caption" color="text.secondary" sx={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{n.preview}</Typography>}
            <Typography variant="caption" color="text.secondary">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};

export default Notifications;
