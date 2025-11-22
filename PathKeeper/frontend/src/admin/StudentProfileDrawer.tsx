import React from 'react';
import { Drawer, Box, IconButton, Typography, Stack, Divider, Chip, LinearProgress, Tooltip, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RiskBadge from '../components/RiskBadge';

export interface StudentProfileData {
  id: string;
  name: string;
  email: string;
  attendance: number;
  gpa: number;
  assignmentsSubmitted: number;
  lastExamScore: number;
  risk: { level: string; score: number };
}

interface Props {
  open: boolean;
  student: StudentProfileData | null;
  onClose: () => void;
}

// Lightweight spark bar generator for metrics (pure CSS)
const MetricBar: React.FC<{ label: string; value: number; max?: number; color?: string; suffix?: string; }> = ({ label, value, max=100, color, suffix='' }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={0.25}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="caption" fontWeight={600}>{value}{suffix}</Typography>
      </Stack>
      <Box sx={{ position:'relative', height:6, borderRadius:4, bgcolor: t=> t.palette.action.hover, overflow:'hidden' }}>
        <Box sx={{ position:'absolute', inset:0, width: pct+'%', bgcolor: color || 'primary.main', transition:'width 480ms cubic-bezier(.4,0,.2,1)' }} />
      </Box>
    </Box>
  );
};

const StudentProfileDrawer: React.FC<Props> = ({ open, student, onClose }) => {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx:{ width:{ xs: '100%', sm: 420 }, borderLeft: t=>`1px solid ${t.palette.divider}` } }}>
      <Box sx={{ display:'flex', flexDirection:'column', height:'100%' }}>
        <Box sx={{ px:2, py:1.5, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Typography variant="h6" fontWeight={700} noWrap>{student?.name || 'Student'}</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <Divider />
        {!student && <LinearProgress />}
        {student && (
          <Box sx={{ p:2, display:'flex', flexDirection:'column', gap:2, overflowY:'auto' }}>
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">{student.email}</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <RiskBadge tier={student.risk.level as any} />
                <Chip size="small" label={`Score ${(student.risk.score ?? 0).toFixed(0)}`} />
              </Stack>
            </Stack>
            <Divider />
            <Stack spacing={1.25}>
              <MetricBar label="Attendance" value={student.attendance} suffix="%" color={student.attendance < 70 ? 'error.main':'success.main'} />
              <MetricBar label="GPA" value={student.gpa} max={4} color={student.gpa < 2.5 ? 'warning.main':'primary.main'} />
              <MetricBar label="Assignments" value={student.assignmentsSubmitted} max={100} />
              <MetricBar label="Last Exam" value={student.lastExamScore} max={100} color={student.lastExamScore < 60 ? 'error.main':'success.main'} />
            </Stack>
            <Divider />
            <Box>
              <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Interventions (Coming Soon)</Typography>
              <Typography variant="caption" color="text.secondary">Logs of counseling sessions and interventions will appear here.</Typography>
            </Box>
            <Divider />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button size="small" variant="contained" onClick={()=> window.alert('Placeholder: Flag for review')}>Flag</Button>
              <Button size="small" variant="outlined" onClick={()=> window.alert('Placeholder: Message Counselor')}>Message Counselor</Button>
              <Button size="small" variant="outlined" onClick={()=> window.alert('Placeholder: Generate Report')}>Report</Button>
            </Stack>
            <Box sx={{ mt:2 }}>
              <Typography variant="caption" color="text.secondary">ID: {student.id}</Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default StudentProfileDrawer;