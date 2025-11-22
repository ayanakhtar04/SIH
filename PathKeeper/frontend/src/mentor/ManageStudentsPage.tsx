import React, { useEffect, useState, useMemo } from 'react';
import { Box, Paper, Typography, IconButton, Drawer, Stack, TextField, Button, Chip, Divider, Tooltip, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, TableSortLabel, Select, MenuItem, FormControl, Checkbox } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { updateStudent } from './studentsApi';
import RiskBadge from '../components/RiskBadge';
import { mapBackendTier } from '../risk/riskUtil';
import Student360Dialog from './Student360Dialog';
import { API } from '../api';
// Charts removed from ManageStudentsPage; shown on dashboard instead

interface StudentRow {
  id:string; name:string; email:string; riskScore?:number; riskTier?:string;
  attendancePercent?:number; cgpa?:number; assignmentsCompleted?:number; assignmentsTotal?:number;
  subjects?: { name:string; score?:number }[]; mentorAcademicNote?:string; mentorId?:string|null;
}

interface Props { token:string; onRiskUpdated?: (id:string, riskScore:number, riskTier:string)=>void; }

const ManageStudentsPage: React.FC<Props> = ({ token, onRiskUpdated }) => {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [mentors, setMentors] = useState<{ id:string; name:string; email:string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [editing, setEditing] = useState<StudentRow|null>(null);
  const [saving, setSaving] = useState(false);
  const [subjectsInput, setSubjectsInput] = useState('');
  const [viewId, setViewId] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name'|'risk'|'attendance'|'cgpa'>('risk');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // decode role from token (simple client-side decode without validation) to determine admin controls
  const role = (()=> { try { const p = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); return p.role || p.user?.role; } catch { return undefined; } })();

  function fetchStudents() {
    setLoading(true); setError(undefined);
    fetch(`${API.students}?page=1&pageSize=200&includeUnassigned=1`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r=> { if(!r.ok) throw new Error(`Failed list (${r.status})`); return r.json(); })
      .then(j => {
        const ds = j.data || j.students || [];
        const mapped: StudentRow[] = ds.map((s:any)=> ({
          id:s.id, name:s.name, email:s.email, riskScore:s.riskScore, riskTier:s.riskTier,
          attendancePercent:s.attendancePercent, cgpa:s.cgpa,
          assignmentsCompleted:s.assignmentsCompleted, assignmentsTotal:s.assignmentsTotal,
          subjects:s.subjects, mentorAcademicNote:s.mentorAcademicNote, mentorId:s.mentorId ?? null
        }));
        setRows(mapped);
      })
      .catch(e=> setError(e.message))
      .finally(()=> setLoading(false));
  }

  function fetchMentors() {
    if (role !== 'admin') return; // only needed for admin reassignment UI
    fetch('/api/users?role=mentor', { headers:{ Authorization:`Bearer ${token}` } })
      .then(r=> r.ok? r.json(): Promise.reject(new Error(`Mentor list ${r.status}`)))
      .then(j=> {
        const list = (j.users || j.data || []).filter((u:any)=> u.role === 'mentor' || u.role==='teacher').map((u:any)=> ({ id:u.id, name:u.name||u.email||'Mentor', email:u.email }));
        setMentors(list);
      })
      .catch(()=> {});
  }

  useEffect(()=> { fetchStudents(); fetchMentors(); }, []);

  const filtered = useMemo(()=> {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle) || (r.riskTier||'').toLowerCase().includes(needle));
  }, [rows, search]);

  const sorted = useMemo(()=> {
    const list = [...filtered];
    list.sort((a,b)=> {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortBy === 'attendance') return ((a.attendancePercent||0) - (b.attendancePercent||0)) * dir;
      if (sortBy === 'cgpa') return ((a.cgpa||0) - (b.cgpa||0)) * dir;
      return ((a.riskScore||0) - (b.riskScore||0)) * dir; // risk
    });
    return list;
  }, [filtered, sortBy, sortDir]);


  function handleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d=> d==='asc'? 'desc':'asc'); else { setSortBy(col); setSortDir(col==='name'? 'asc':'desc'); }
  }

  const toggleSelectAll = (checked:boolean) => {
    if (!checked) { setSelected(new Set()); return; }
    const ids = sorted.filter(r=> !r.mentorId).map(r=> r.id); // only unassigned eligible
    setSelected(new Set(ids));
  };
  const toggleRow = (id:string) => {
    setSelected(s=> { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const bulkClaim = async () => {
    const targets = Array.from(selected).filter(id => {
      const row = rows.find(r=> r.id===id); return row && !row.mentorId;
    });
    if (!targets.length) return;
    for (const id of targets) {
      try {
        const resp = await fetch(`${API.students}/${id}/claim`, { method:'POST', headers:{ Authorization:`Bearer ${token}` } });
        if (resp.ok) {
          const js = await resp.json().catch(()=>null);
          setRows(rs => rs.map(r=> r.id===id? { ...r, mentorId: js?.student?.mentorId || 'me' }: r));
        }
      } catch { /* ignore each */ }
    }
    setSelected(new Set());
    setBulkMode(false);
  try { window.dispatchEvent(new CustomEvent('pk:students-updated')); } catch {}
  };

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
  try { window.dispatchEvent(new CustomEvent('pk:students-updated')); } catch {}
      setEditing(null);
    } catch(e:any) {
      alert(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:3 }}>
      <Stack direction={{ xs:'column', md:'row' }} spacing={2} alignItems={{ xs:'flex-start', md:'center' }} justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h4" fontWeight={700}>Students</Typography>
          <IconButton size="small" onClick={fetchStudents} disabled={loading}><RefreshIcon fontSize="small" /></IconButton>
          <Button size="small" variant={bulkMode? 'contained':'outlined'} onClick={()=> { if(bulkMode){ setBulkMode(false); setSelected(new Set()); } else setBulkMode(true); }}>
            {bulkMode? `Cancel (${selected.size})` : 'Bulk Claim'}
          </Button>
          {bulkMode && <Button size="small" disabled={!selected.size} onClick={bulkClaim} variant="contained">Claim {selected.size}</Button>}
        </Stack>
        <Box sx={{ position:'relative', maxWidth:280 }}>
          <SearchIcon fontSize="small" style={{ position:'absolute', top:8, left:8, opacity:0.55 }} />
          <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="Search name/email/risk..." style={{ width:'100%', padding:'8px 10px 8px 28px', borderRadius:8, outline:'none', border:'1px solid rgba(0,0,0,0.25)', background:'transparent', color:'inherit' }} />
        </Box>
      </Stack>
      {/* Charts removed from this page; they live in the Mentor Dashboard */}
      {error && <Typography variant="caption" color="error">{error}</Typography>}
      {loading && <Typography variant="caption">Loading...</Typography>}
      {!loading && !error && rows.length===0 && (
        <Paper variant="outlined" sx={{ p:3 }}>
          <Typography variant="h6" fontWeight={600}>No Students</Typography>
          <Typography variant="body2" color="text.secondary">You have no assigned or unassigned students visible. Ask an admin to import or assign students, then refresh.</Typography>
        </Paper>
      )}
      {rows.length>0 && (
        <Paper variant="outlined" sx={{ p:1.5, overflowX:'auto' }}>
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {bulkMode && <TableCell padding="checkbox">
                    <Checkbox size="small" indeterminate={selected.size>0 && selected.size<sorted.filter(r=> !r.mentorId).length} checked={selected.size>0 && selected.size===sorted.filter(r=> !r.mentorId).length && sorted.filter(r=> !r.mentorId).length>0} onChange={(e)=> toggleSelectAll(e.target.checked)} />
                  </TableCell>}
                  <TableCell sortDirection={sortBy==='name'? sortDir:false}>
                    <TableSortLabel active={sortBy==='name'} direction={sortBy==='name'? sortDir:'asc'} onClick={()=> handleSort('name')}>Name</TableSortLabel>
                  </TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Mentor</TableCell>
                  <TableCell sortDirection={sortBy==='risk'? sortDir:false}>
                    <TableSortLabel active={sortBy==='risk'} direction={sortBy==='risk'? sortDir:'desc'} onClick={()=> handleSort('risk')}>Risk</TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy==='attendance'? sortDir:false}>
                    <TableSortLabel active={sortBy==='attendance'} direction={sortBy==='attendance'? sortDir:'desc'} onClick={()=> handleSort('attendance')}>Attendance%</TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy==='cgpa'? sortDir:false}>
                    <TableSortLabel active={sortBy==='cgpa'} direction={sortBy==='cgpa'? sortDir:'desc'} onClick={()=> handleSort('cgpa')}>CGPA</TableSortLabel>
                  </TableCell>
                  <TableCell>Assignments</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map(r => (
                  <TableRow key={r.id} hover selected={bulkMode && selected.has(r.id)}>
                    {bulkMode && <TableCell padding="checkbox">
                      <Checkbox size="small" disabled={!!r.mentorId} checked={selected.has(r.id)} onChange={()=> toggleRow(r.id)} />
                    </TableCell>}
                    <TableCell sx={{ maxWidth:180 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{r.name}</Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth:220 }}>
                      <Typography variant="caption" color="text.secondary" noWrap>{r.email}</Typography>
                    </TableCell>
                    <TableCell>
                      {role==='admin' ? (
                        <FormControl size="small" sx={{ minWidth:120 }}>
                          <Select value={r.mentorId || ''} displayEmpty onChange={async (e)=> {
                            const newMentorId = e.target.value === '' ? null : String(e.target.value);
                            try {
                              const resp = await fetch(`${API.students}/${r.id}/assign-mentor`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ mentorId: newMentorId }) });
                              if(!resp.ok) throw new Error(`Assign failed (${resp.status})`);
                              const js = await resp.json();
                              setRows(rs => rs.map(x=> x.id===r.id? { ...x, mentorId: js.student.mentorId }: x));
                              try { window.dispatchEvent(new CustomEvent('pk:students-updated')); } catch {}
                            } catch(e:any) { alert(e.message || 'Assign failed'); }
                          }} renderValue={(val)=> {
                            if(!val) return <Typography variant="caption" color="text.secondary">Unassigned</Typography>;
                            const m = mentors.find(m=> m.id===val);
                            return m? m.name || m.email : val;
                          }}>
                            <MenuItem value=""><em>Unassigned</em></MenuItem>
                            {mentors.map(m=> <MenuItem key={m.id} value={m.id}>{m.name || m.email}</MenuItem>)}
                          </Select>
                        </FormControl>
                      ) : (
                        <Chip size="small" label={r.mentorId? 'Assigned':'Unassigned'} color={r.mentorId? 'success':'default'} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <RiskBadge tier={mapBackendTier(r.riskTier as any) as any} />
                        {r.riskScore!=null && <Typography variant="caption" color="text.secondary">{(r.riskScore*100).toFixed(0)}</Typography>}
                      </Stack>
                    </TableCell>
                    <TableCell>{r.attendancePercent!=null? r.attendancePercent:'—'}</TableCell>
                    <TableCell>{r.cgpa!=null? r.cgpa.toFixed(2):'—'}</TableCell>
                    <TableCell>{(r.assignmentsCompleted!=null && r.assignmentsTotal!=null)? `${r.assignmentsCompleted}/${r.assignmentsTotal}`:'—'}</TableCell>
                    <TableCell sx={{ maxWidth:200 }}>{r.mentorAcademicNote && <Typography variant="caption" noWrap>{r.mentorAcademicNote}</Typography>}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                        {!r.mentorId && (
                          <Tooltip title="Claim Student">
                            <IconButton size="small" onClick={async ()=> {
                              try {
                                const resp = await fetch(`${API.students}/${r.id}/claim`, { method:'POST', headers:{ Authorization:`Bearer ${token}` } });
                                if(!resp.ok){ const js = await resp.json().catch(()=>null); throw new Error(js?.error || `Claim failed (${resp.status})`); }
                                const js = await resp.json();
                                setRows(rs => rs.map(x=> x.id===r.id? { ...x, mentorId: js.student.mentorId }: x));
                                try { window.dispatchEvent(new CustomEvent('pk:students-updated')); } catch {}
                              } catch(e:any) {
                                alert(e.message || 'Claim failed');
                              }
                            }}>
                              <PersonAddIcon fontSize="inherit" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="360 View"><IconButton size="small" onClick={()=> setViewId(r.id)}><VisibilityIcon fontSize="inherit" /></IconButton></Tooltip>
                        <Tooltip title="Edit"><IconButton size="small" onClick={()=> openEdit(r)}><EditIcon fontSize="inherit" /></IconButton></Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!sorted.length && (
                  <TableRow>
                    <TableCell colSpan={8}><Typography variant="body2" color="text.secondary">No students match search.</Typography></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
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
      <Student360Dialog open={!!viewId} onClose={()=> setViewId(null)} token={token} studentId={viewId} />
    </Box>
  );
};

export default ManageStudentsPage;
