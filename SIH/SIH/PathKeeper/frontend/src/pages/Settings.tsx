import React, { useState } from 'react';
import { Box, Button, Paper, Stack, Switch, Typography } from '@mui/material';
import { API } from '../api';


interface SettingsProps {
  dark: boolean;
  onToggleDark: () => void;
  reloadStudents?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ dark, onToggleDark, reloadStudents }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const regenerate = async () => {
    try {
      setBusy(true);
      setMsg(null);
      const res = await fetch(API.regenerate, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed (${res.status}) ${text || ''}`.trim());
      }
      const json = await res.json();
      const acc = json.trained?.overall?.accuracy;
      const f1 = json.trained?.overall?.macro_f1;
      setMsg(`Dataset regenerated. New model v${json.trained?.version} acc=${(acc ?? 0).toFixed(3)} f1=${(f1 ?? 0).toFixed(3)}`);
      if (reloadStudents) reloadStudents();
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      setMsg(`Error regenerating dataset: ${err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Settings</Typography>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Dark mode</Typography>
              <Typography variant="body2" color="text.secondary">Toggle theme appearance</Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">Light</Typography>
              <Switch checked={dark} onChange={onToggleDark} />
              <Typography variant="body2">Dark</Typography>
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Generate New Dataset & Retrain</Typography>
              <Typography variant="body2" color="text.secondary">Creates synthetic data and retrains the model.</Typography>
            </Box>
            <Button variant="contained" onClick={regenerate} disabled={busy}>{busy ? 'Working…' : 'Run'}</Button>
          </Stack>
          {msg && <Typography variant="body2" sx={{ mt: 1 }}>{msg}</Typography>}
        </Paper>
      </Stack>
    </Box>
  );
};

export default Settings;
