import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, IconButton, Drawer, Stack, TextField, Button, Chip, Divider, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import { updateStudent } from './studentsApi';
import RiskBadge from '../components/RiskBadge';
import { API } from '../api';

interface StudentRow {
  id:string; name:string; email:string; riskScore?:number; riskTier?:string;
  attendancePercent?:number; cgpa?:number; assignmentsCompleted?:number; assignmentsTotal?:number;
  subjects?: { name:string; score?:number }[]; mentorAcademicNote?:string;
}

interface Props { token:string; onRiskUpdated?: (id:string, riskScore:number, riskTier:string)=>void; }

const ManageStudentsPage: React.FC<Props> = ({ token, onRiskUpdated }) => {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [editing, setEditing] = useState<StudentRow|null>(null);
  const [saving, setSaving] = useState(false);
  const [subjectsInput, setSubjectsInput] = useState('');

  const fetchStudents = () => {
    setLoading(true); setError(undefined);
    fetch(`${API.students}?page=1&pageSize=100`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r=> { if(!r.ok) throw new Error('Failed list'); return r.json(); })
      .then(j => {
        const ds = j.data || j.students || [];
        const mapped: StudentRow[] = ds.map((s:any)=> ({
          id:s.id, name:s.name, email:s.email, riskScore:s.riskScore, riskTier:s.riskTier,
          attendancePercent:s.attendancePercent, cgpa:s.cgpa,
          assignmentsCompleted:s.assignmentsCompleted, assignmentsTotal:s.assignmentsTotal,
          subjects:s.subjects, mentorAcademicNote:s.mentorAcademicNote
        }));
        setRows(mapped);
      })
      .catch(e=> setError(e.message))
      .finally(()=> setLoading(false));
  };

  useEffect(()=> { fetchStudents(); }, []);

  const openEdit = (r:StudentRow) => {
    setEditing(r);
    setSubjectsInput(r.subjects?.map(s=> s.score!=null? `${s.name}:${s.score}`: s.name).join(', ') || '');
  };

  const parseSubjects = (): { name:string; score?:number }[] => {
    return subjectsInput.split(',').map(s=> s.trim()).filter(Boolean).map(tok => {
      const [name,scoreStr] = tok.split(':').map(x=> x.trim());
      const scoreNum = scoreStr!=null && scoreStr!=='' ? Number(scoreStr) : undefined;
      return { name, score: isNaN(scoreNum as any)? undefined: scoreNum };
    }).slice(0,50);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload:any = {
        attendancePercent: editing.attendancePercent,
        cgpa: editing.cgpa,
        assignmentsCompleted: editing.assignmentsCompleted,
        assignmentsTotal: editing.assignmentsTotal,
        mentorAcademicNote: editing.mentorAcademicNote,
        subjects: parseSubjects()
      };
      const resp = await updateStudent(token, editing.id, payload);
      const { student } = resp;
      setRows(rs => rs.map(r=> r.id===editing.id? { ...r, ...payload, riskScore: student.riskScore, riskTier: student.riskTier }: r));
      if (student.riskScore != null && student.riskTier && onRiskUpdated) onRiskUpdated(editing.id, student.riskScore, student.riskTier);
      setEditing(null);
    } catch(e:any) {
      alert(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h4" fontWeight={700}>Manage Students</Typography>
        <IconButton size="small" onClick={fetchStudents} disabled={loading}><RefreshIcon fontSize="small" /></IconButton>
        {loading && <Typography variant="caption">Loading...</Typography>}
        {error && <Typography variant="caption" color="error">{error}</Typography>}
      </Stack>
      <Box sx={{ display:'grid', gap:2, gridTemplateColumns:{ xs:'1fr', md:'repeat(auto-fill,minmax(340px,1fr))' } }}>
        {rows.map(r => (
          <Paper key={r.id} variant="outlined" sx={{ p:2, display:'flex', flexDirection:'column', gap:1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={600} noWrap>{r.name}</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <RiskBadge tier={r.riskTier as any} />
                <IconButton size="small" onClick={()=> openEdit(r)}><EditIcon fontSize="small" /></IconButton>
              </Stack>
            </Stack>
            <Typography variant="caption" color="text.secondary" noWrap>{r.email}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {r.attendancePercent!=null && <Chip size="small" label={`Att ${r.attendancePercent}%`} />}
              {r.cgpa!=null && <Chip size="small" label={`CGPA ${r.cgpa.toFixed(2)}`} />}
              {(r.assignmentsCompleted!=null && r.assignmentsTotal!=null) && <Chip size="small" label={`Assign ${r.assignmentsCompleted}/${r.assignmentsTotal}`} />}
            </Stack>
            {r.mentorAcademicNote && <Typography variant="body2" sx={{ mt:0.5 }} noWrap>{r.mentorAcademicNote}</Typography>}
          </Paper>
        ))}
        {!rows.length && !loading && <Typography variant="body2" color="text.secondary">No students</Typography>}
      </Box>
      <Drawer anchor="right" open={!!editing} onClose={()=> !saving && setEditing(null)}>
        <Box sx={{ width:{ xs:320, sm:380 }, p:2, display:'flex', flexDirection:'column', gap:2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={600}>Edit Student</Typography>
            <IconButton size="small" onClick={()=> !saving && setEditing(null)}><CloseIcon fontSize="small" /></IconButton>
          </Stack>
          {editing && (
            <>
              <Typography variant="subtitle2" color="text.secondary">{editing.name}</Typography>
              <TextField type="number" label="Attendance %" value={editing.attendancePercent ?? ''} onChange={e=> setEditing(s=> s? { ...s, attendancePercent: e.target.value===''? undefined: Number(e.target.value) }: s)} size="small" fullWidth />
              <TextField type="number" label="CGPA" value={editing.cgpa ?? ''} onChange={e=> setEditing(s=> s? { ...s, cgpa: e.target.value===''? undefined: Number(e.target.value) }: s)} size="small" fullWidth />
              <Stack direction="row" spacing={1}>
                <TextField type="number" label="Assignments Done" value={editing.assignmentsCompleted ?? ''} onChange={e=> setEditing(s=> s? { ...s, assignmentsCompleted: e.target.value===''? undefined: Number(e.target.value) }: s)} size="small" fullWidth />
                <TextField type="number" label="Assignments Total" value={editing.assignmentsTotal ?? ''} onChange={e=> setEditing(s=> s? { ...s, assignmentsTotal: e.target.value===''? undefined: Number(e.target.value) }: s)} size="small" fullWidth />
              </Stack>
              <TextField label="Subjects (name[:score], comma separated)" value={subjectsInput} onChange={e=> setSubjectsInput(e.target.value)} size="small" fullWidth />
              <TextField label="Academic Note" value={editing.mentorAcademicNote ?? ''} onChange={e=> setEditing(s=> s? { ...s, mentorAcademicNote: e.target.value }: s)} size="small" fullWidth multiline minRows={3} />
              <Divider />
              <Stack direction="row" spacing={1}>
                <Button startIcon={<CloseIcon />} onClick={()=> !saving && setEditing(null)} disabled={saving}>Cancel</Button>
                <Button startIcon={<SaveIcon />} variant="contained" onClick={handleSave} disabled={saving}>Save</Button>
              </Stack>
            </>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};

export default ManageStudentsPage;
