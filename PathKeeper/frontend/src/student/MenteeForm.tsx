import React, { useEffect, useState } from 'react';
import { 
  Box, Button, Stack, TextField, Typography, Paper, Grid, 
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio,
  Container, Alert, CircularProgress
} from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../api';

const endpoint = `${API_BASE}/mentee-form`;

interface MenteeFormProps {
  studentId?: string;
  isMentor?: boolean;
  onClose?: () => void;
}

const MenteeForm: React.FC<MenteeFormProps> = ({ studentId: propStudentId, isMentor = false, onClose }) => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [form, setForm] = useState<any>({
    name: '', enrollment: '', blood_group: '', dob: '', father_name: '', mother_name: '',
    student_email: '', father_email: '', student_mobile: '', father_mobile: '', mother_mobile: '',
    course: '', branch: '', department: '', semester: '', hobbies: '', gender: 'male',
    permanent_address: '', correspondence_address: '',
    odd_sem_year: '', odd_sem_marks: '', even_sem_year: '', even_sem_marks: '', back_papers: '',
    career_aspirations: '', institute_help: '',
    personal_problems: '', professional_problems: '', disciplinary_record: '',
    student_signature: '', mentor_signature: ''
  });

  const [targetStudentId, setTargetStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let sid = propStudentId;
    if (!sid) {
      try {
        const payload = JSON.parse(atob(session.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
        sid = payload.sub;
      } catch (e) { /* ignore */ }
    }
    setTargetStudentId(sid || null);

    if (sid) {
      setFetching(true);
      fetch(`${endpoint}/${sid}`, { headers: { Authorization: `Bearer ${session.token}` } })
        .then(r => { 
            if (!r.ok) {
                // If 404, it might just mean no form exists yet, which is fine.
                if(r.status === 404) return { data: {} };
                throw new Error('Failed to load form'); 
            }
            return r.json(); 
        })
        .then(j => { 
          if (j.data) setForm((prev:any) => ({ ...prev, ...j.data })); 
          if (j.data && Object.keys(j.data).length > 0) setSaved(true);
        })
        .catch((err) => {
            console.error(err);
            setError("Could not load existing form data.");
        })
        .finally(() => setFetching(false));
    } else {
        setFetching(false);
    }
  }, [session, propStudentId]);

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (['student_mobile', 'father_mobile', 'mother_mobile'].includes(name)) {
      const numeric = value.replace(/\D/g, '').slice(0, 10);
      setForm((p:any) => ({ ...p, [name]: numeric }));
    } else {
      setForm((p:any) => ({ ...p, [name]: value }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm((prev: any) => ({ ...prev, [field]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session || !targetStudentId) return;
    setLoading(true);
    setError(null);
    const token = session.token;
    
    const url = isMentor ? `${endpoint}/${targetStudentId}` : endpoint;

    try {
        const res = await fetch(url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
            body: JSON.stringify(form) 
        });
        if (!res.ok) throw new Error('Save failed');
        setSaved(true);
        alert('Form saved successfully');
        if (onClose) onClose();
    } catch (err) {
        setError('Failed to save form.');
    } finally {
        setLoading(false);
    }
  };

  const downloadPdf = async () => {
      if(!session?.token || !targetStudentId) return;
      try {
        const res = await fetch(`${API_BASE}/mentee-form/${targetStudentId}/pdf`, {
          headers: { Authorization: `Bearer ${session.token}` }
        });
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mentee-form-${targetStudentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch(e) { alert('Failed to download PDF'); }
  };

  const isStudentFieldDisabled = isMentor;
  const isMentorFieldDisabled = !isMentor;

  if (fetching) return <Box sx={{ display:'flex', justifyContent:'center', p: 5 }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Mentee Registration Form
        </Typography>
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={submit}>
          <Stack spacing={3}>
            
            {/* Section 1: Personal Details */}
            <Box>
                <Typography variant="h6" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>Personal Details</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField fullWidth label="1. Name of the Student (In CAPITAL)" name="name" value={form.name} onChange={change} required disabled={isStudentFieldDisabled} variant="outlined" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="2. Enrolment Number" name="enrollment" value={form.enrollment} onChange={change} required disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="5. Blood Group" name="blood_group" value={form.blood_group} onChange={change} disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Date of Birth" name="dob" type="date" value={form.dob} onChange={change} disabled={isStudentFieldDisabled} InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="3. Father's Name (in CAPITAL)" name="father_name" value={form.father_name} onChange={change} required disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="4. Mother's Name (in CAPITAL)" name="mother_name" value={form.mother_name} onChange={change} required disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12}>
                        <FormControl component="fieldset" disabled={isStudentFieldDisabled}>
                            <FormLabel component="legend">Gender</FormLabel>
                            <RadioGroup row name="gender" value={form.gender} onChange={change}>
                                <FormControlLabel value="male" control={<Radio />} label="Male" />
                                <FormControlLabel value="female" control={<Radio />} label="Female" />
                            </RadioGroup>
                        </FormControl>
                    </Grid>
                </Grid>
            </Box>

            {/* Section 2: Contact Details */}
            <Box>
                <Typography variant="h6" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>Contact Details</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="6. Email-id (STUDENT)" name="student_email" type="email" value={form.student_email} onChange={change} required disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="7. Email-id (FATHER)" name="father_email" type="email" value={form.father_email} onChange={change} disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField fullWidth label="8. Mobile No (STUDENT)" name="student_mobile" value={form.student_mobile} onChange={change} required disabled={isStudentFieldDisabled} inputProps={{ maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }} placeholder="10-digit number" />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField fullWidth label="9. Mobile No (FATHER)" name="father_mobile" value={form.father_mobile} onChange={change} disabled={isStudentFieldDisabled} inputProps={{ maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }} placeholder="10-digit number" />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField fullWidth label="10. Mobile No (MOTHER)" name="mother_mobile" value={form.mother_mobile} onChange={change} disabled={isStudentFieldDisabled} inputProps={{ maxLength: 10, inputMode: 'numeric', pattern: '[0-9]*' }} placeholder="10-digit number" />
                    </Grid>
                </Grid>
            </Box>

            {/* Section 3: Academic Details */}
            <Box>
                <Typography variant="h6" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>Academic Details</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="11. Course" name="course" value={form.course} onChange={change} required disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="12. Branch" name="branch" value={form.branch} onChange={change} required disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Department" name="department" value={form.department} onChange={change} disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Semester" name="semester" value={form.semester} onChange={change} disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth label="13. Hobbies" name="hobbies" value={form.hobbies} onChange={change} disabled={isStudentFieldDisabled} />
                    </Grid>
                </Grid>
            </Box>

            {/* Section 4: Address Details */}
            <Box>
                <Typography variant="h6" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>14. Address Details</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField fullWidth multiline rows={3} label="Permanent Address" name="permanent_address" value={form.permanent_address} onChange={change} disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth multiline rows={3} label="Correspondence Address" name="correspondence_address" value={form.correspondence_address} onChange={change} disabled={isStudentFieldDisabled} />
                    </Grid>
                </Grid>
            </Box>

            {/* Section 5: Academic Performance */}
            <Box>
                <Typography variant="h6" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>15. Academic Performance (Last 2 Semesters)</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>A. Odd Sem. (202__)</Typography>
                            <Stack spacing={2}>
                                <TextField fullWidth size="small" label="Year (e.g., 3-4)" name="odd_sem_year" value={form.odd_sem_year} onChange={change} disabled={isStudentFieldDisabled} />
                                <TextField fullWidth size="small" label="Marks (% or CGPA)" name="odd_sem_marks" value={form.odd_sem_marks} onChange={change} disabled={isStudentFieldDisabled} />
                            </Stack>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>B. Even Sem. (202__)</Typography>
                            <Stack spacing={2}>
                                <TextField fullWidth size="small" label="Year (e.g., 3-4)" name="even_sem_year" value={form.even_sem_year} onChange={change} disabled={isStudentFieldDisabled} />
                                <TextField fullWidth size="small" label="Marks (% or CGPA)" name="even_sem_marks" value={form.even_sem_marks} onChange={change} disabled={isStudentFieldDisabled} />
                            </Stack>
                        </Paper>
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth label="C. Back Papers (if any)" placeholder="List the subjects/codes" name="back_papers" value={form.back_papers} onChange={change} disabled={isStudentFieldDisabled} />
                    </Grid>
                </Grid>
            </Box>

            {/* Section 6: Aspirations */}
            <Box>
                <Typography variant="h6" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>Aspirations</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField fullWidth multiline rows={4} label="16. What are your career aspirations?" name="career_aspirations" value={form.career_aspirations} onChange={change} disabled={isStudentFieldDisabled} />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth multiline rows={4} label="17. How can the institute help you in achieving your aspirations?" name="institute_help" value={form.institute_help} onChange={change} disabled={isStudentFieldDisabled} />
                    </Grid>
                </Grid>
            </Box>

            {/* Section 7: Mentor Section */}
            <Paper variant="outlined" sx={{ p: 3, bgcolor: 'action.hover', borderColor: 'primary.main' }}>
                <Typography variant="h6" color="primary" sx={{ mb: 2 }}>To be filled by the Mentor (Sections 18-20)</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField fullWidth multiline rows={3} label="18. Personal Problems (if any)" name="personal_problems" value={form.personal_problems} onChange={change} disabled={isMentorFieldDisabled} />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth multiline rows={3} label="19. Professional Problems (if any)" name="professional_problems" value={form.professional_problems} onChange={change} disabled={isMentorFieldDisabled} />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField fullWidth label="20. Disciplinary Record" placeholder="Whether punished for any act of indiscipline" name="disciplinary_record" value={form.disciplinary_record} onChange={change} disabled={isMentorFieldDisabled} />
                    </Grid>
                </Grid>
            </Paper>

            {/* Signatures */}
            <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Grid container spacing={4} justifyContent="space-around">
                    <Grid item xs={4} sx={{ textAlign: 'center' }}>
                        <Box sx={{ mb: 2, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed grey' }}>
                            {form.student_signature ? (
                                <img src={form.student_signature} alt="Student Signature" style={{ maxHeight: '100%', maxWidth: '100%' }} />
                            ) : (
                                <Typography variant="caption" color="text.secondary">No Signature</Typography>
                            )}
                        </Box>
                        {!isStudentFieldDisabled && (
                            <Button variant="outlined" component="label" size="small" sx={{ mb: 1 }}>
                                Upload Signature
                                <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, 'student_signature')} />
                            </Button>
                        )}
                        <Box sx={{ borderTop: 1, borderColor: 'text.primary', pt: 1 }}>
                            <Typography variant="body2">Signature of Student (Mentee)</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={4} sx={{ textAlign: 'center' }}>
                        <Box sx={{ mb: 2, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed grey' }}>
                            {form.mentor_signature ? (
                                <img src={form.mentor_signature} alt="Mentor Signature" style={{ maxHeight: '100%', maxWidth: '100%' }} />
                            ) : (
                                <Typography variant="caption" color="text.secondary">No Signature</Typography>
                            )}
                        </Box>
                        {!isMentorFieldDisabled && (
                            <Button variant="outlined" component="label" size="small" sx={{ mb: 1 }}>
                                Upload Signature
                                <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, 'mentor_signature')} />
                            </Button>
                        )}
                        <Box sx={{ borderTop: 1, borderColor: 'text.primary', pt: 1 }}>
                            <Typography variant="body2">Signature of Mentor</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={4} sx={{ textAlign: 'center' }}>
                        <Box sx={{ height: 100 }} /> {/* Spacer for alignment */}
                        <Box sx={{ borderTop: 1, borderColor: 'text.primary', pt: 1, mt: 4 }}>
                            <Typography variant="body2">Signature of Dy. Dean (FCI)</Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Box>

            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
                <Button variant="contained" size="large" type="submit" disabled={loading}>
                    {loading ? 'Saving…' : 'Save Form'}
                </Button>
                {saved && targetStudentId && (
                    <Button variant="outlined" size="large" onClick={downloadPdf}>
                        Download PDF
                    </Button>
                )}
                {onClose && (
                    <Button variant="text" size="large" onClick={onClose}>
                        Close
                    </Button>
                )}
            </Stack>

          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

export default MenteeForm;


