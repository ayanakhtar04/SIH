import React, { useState } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Dialog, DialogContent, Stack } from '@mui/material';
import MenteeForm from '../student/MenteeForm';
import { API_BASE } from '../api';
import { useAuth } from '../auth/AuthContext';

interface MenteeFormsListProps {
  students: any[];
}

const MenteeFormsList: React.FC<MenteeFormsListProps> = ({ students }) => {
  const { session } = useAuth();
  const [editStudentId, setEditStudentId] = useState<string | null>(null);

  const handleDownload = async (studentId: string) => {
    if (!session?.token) return;
    try {
      const res = await fetch(`${API_BASE}/mentee-form/${studentId}/pdf`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mentee-form-${studentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert('Failed to download PDF');
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>Mentee Forms Management</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        View and manage registration forms for your assigned mentees.
      </Typography>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Student Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell>{student.name}</TableCell>
                <TableCell>{student.email}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button variant="outlined" size="small" onClick={() => handleDownload(student.id)}>
                      Download PDF
                    </Button>
                    <Button variant="contained" size="small" onClick={() => setEditStudentId(student.id)}>
                      Edit
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  No students assigned.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!editStudentId} onClose={() => setEditStudentId(null)} fullWidth maxWidth="lg">
        <DialogContent sx={{ p: 0 }}>
          {editStudentId && (
            <MenteeForm 
              studentId={editStudentId} 
              isMentor={true} 
              onClose={() => setEditStudentId(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  );
};

export default MenteeFormsList;
