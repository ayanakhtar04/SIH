import React from 'react';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Chip, TextField, InputAdornment, IconButton, Toolbar, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';

interface StudentRow { id: number; name: string; email: string; risk: number; attendance: number; }

export const TeacherDashboard: React.FC<{ token: string; onLogout: () => void; }> = ({ token, onLogout }) => {
  const [rows, setRows] = React.useState<StudentRow[]>([]);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch((import.meta as any).env.VITE_API_BASE?.replace('/api/auth','/api/teacher/students') || 'http://127.0.0.1:7070/api/teacher/students', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      setRows(data.students || []);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  React.useEffect(()=> { fetchData(); }, []);

  const filtered = rows.filter(r => r.name.toLowerCase().includes(query.toLowerCase()) || r.email.toLowerCase().includes(query.toLowerCase()));

  return (
    <Box sx={{ width:'100%', maxWidth:1200, mx:'auto', p:4 }}>
      <Toolbar disableGutters sx={{ mb:2, display:'flex', gap:2, justifyContent:'space-between' }}>
        <Typography variant="h4" fontWeight={700}>Teacher Overview</Typography>
        <Box sx={{ display:'flex', gap:2 }}>
          <TextField size="small" placeholder="Search students" value={query} onChange={e=>setQuery(e.target.value)} InputProps={{ startAdornment:<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
          <Tooltip title="Refresh"><IconButton onClick={fetchData} disabled={loading}><RefreshIcon /></IconButton></Tooltip>
          <Chip color="primary" label="Logout" onClick={onLogout} variant="outlined" />
        </Box>
      </Toolbar>
      <Paper elevation={3} sx={{ borderRadius:3, overflow:'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell align="right">Attendance %</TableCell>
              <TableCell align="right">Risk</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id} hover>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell align="right">{r.attendance}</TableCell>
                <TableCell align="right">
                  <Chip size="small" label={r.risk} color={r.risk >=70? 'error': r.risk >=40? 'warning':'success'} />
                </TableCell>
              </TableRow>
            ))}
            {!loading && filtered.length===0 && (
              <TableRow><TableCell colSpan={4} align="center" style={{ padding:40, opacity:0.7 }}>No students match.</TableCell></TableRow>
            )}
            {loading && (
              <TableRow><TableCell colSpan={4} align="center" style={{ padding:40 }}>Loading…</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};
