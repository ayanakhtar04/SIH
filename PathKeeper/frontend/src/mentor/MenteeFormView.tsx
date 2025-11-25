import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Stack, CircularProgress, Divider, Button } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../api';

interface MenteeFormViewProps {
  studentId: string;
  onClose?: () => void;
}

const MenteeFormView: React.FC<MenteeFormViewProps> = ({ studentId, onClose }) => {
  const { session } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !session?.token) return;
    setLoading(true);
    fetch(`${API_BASE}/mentee-form/${studentId}`, {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then(async r => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`Status ${r.status}`);
        return r.json();
      })
      .then(json => {
        if (json && json.ok) setData(json.data);
        else if (json) setError(json.error);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId, session]);

  const downloadPdf = () => {
    if (!session?.token) return;
    window.open(`${API_BASE}/mentee-form/${studentId}/pdf`, '_blank');
  };

  if (loading) return <Box p={3}><CircularProgress /></Box>;
  if (error) return <Box p={3}><Typography color="error">{error}</Typography></Box>;
  if (!data) return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <Typography variant="h6" color="text.secondary">Student has not submitted the onboarding form yet.</Typography>
      {onClose && <Box mt={2}><Button onClick={onClose}>Close</Button></Box>}
    </Paper>
  );

  const Field = ({ label, value }: { label: string, value: any }) => (
    <Box sx={{ minWidth: '150px', mb: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{value || '—'}</Typography>
    </Box>
  );

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Mentee Registration Form</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" onClick={downloadPdf}>Download PDF</Button>
          {onClose && <Button size="small" onClick={onClose}>Close</Button>}
        </Stack>
      </Stack>

      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ bgcolor: 'action.hover', p: 0.5, borderRadius: 1 }}>Personal Details</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <Field label="Name" value={data.name} />
            <Field label="Enrollment No" value={data.enrollment} />
            <Field label="Blood Group" value={data.blood_group} />
            <Field label="Gender" value={data.gender} />
            <Field label="Hobbies" value={data.hobbies} />
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ bgcolor: 'action.hover', p: 0.5, borderRadius: 1 }}>Family Details</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <Field label="Father's Name" value={data.father_name} />
            <Field label="Mother's Name" value={data.mother_name} />
            <Field label="Father's Email" value={data.father_email} />
            <Field label="Father's Mobile" value={data.father_mobile} />
            <Field label="Mother's Mobile" value={data.mother_mobile} />
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ bgcolor: 'action.hover', p: 0.5, borderRadius: 1 }}>Contact Details</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <Field label="Student Email" value={data.student_email} />
            <Field label="Student Mobile" value={data.student_mobile} />
          </Stack>
          <Stack spacing={1} mt={1}>
            <Field label="Permanent Address" value={data.permanent_address} />
            <Field label="Correspondence Address" value={data.correspondence_address} />
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ bgcolor: 'action.hover', p: 0.5, borderRadius: 1 }}>Academic Details</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <Field label="Course" value={data.course} />
            <Field label="Branch" value={data.branch} />
            <Field label="Department" value={data.department} />
            <Field label="Semester" value={data.semester} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={1} flexWrap="wrap" useFlexGap>
            <Field label="Odd Sem Year" value={data.odd_sem_year} />
            <Field label="Odd Sem Marks" value={data.odd_sem_marks} />
            <Field label="Even Sem Year" value={data.even_sem_year} />
            <Field label="Even Sem Marks" value={data.even_sem_marks} />
            <Field label="Back Papers" value={data.back_papers} />
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ bgcolor: 'action.hover', p: 0.5, borderRadius: 1 }}>Aspirations & Help</Typography>
          <Stack spacing={2}>
            <Field label="Career Aspirations" value={data.career_aspirations} />
            <Field label="Institute Help Needed" value={data.institute_help} />
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ bgcolor: 'action.hover', p: 0.5, borderRadius: 1 }}>Mentor Section (Read Only)</Typography>
          <Stack spacing={2}>
            <Field label="Personal Problems" value={data.personal_problems} />
            <Field label="Professional Problems" value={data.professional_problems} />
            <Field label="Disciplinary Record" value={data.disciplinary_record} />
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};

export default MenteeFormView;
