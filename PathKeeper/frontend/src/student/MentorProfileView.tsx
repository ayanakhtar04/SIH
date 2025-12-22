import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Stack, CircularProgress, Avatar, Divider, Chip } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../api';

interface MentorProfileViewProps {
  mentorId: string | null;
}

const MentorProfileView: React.FC<MentorProfileViewProps> = ({ mentorId }) => {
  const { session } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mentorId || !session?.token) return;
    setLoading(true);
    fetch(`${API_BASE}/mentor-form/${mentorId}`, {
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
  }, [mentorId, session]);

  if (!mentorId) {
    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <Typography variant="h6" color="text.secondary">No mentor assigned.</Typography>
      </Paper>
    );
  }

  if (loading) return <Box p={3}><CircularProgress /></Box>;
  if (error) return <Box p={3}><Typography color="error">{error}</Typography></Box>;
  if (!data) return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <Typography variant="h6" color="text.secondary">Mentor has not completed their profile yet.</Typography>
    </Paper>
  );

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: 32 }}>
          {data.fullName ? data.fullName.charAt(0) : 'M'}
        </Avatar>
        <Box flex={1}>
          <Typography variant="h4" fontWeight={700} gutterBottom>{data.fullName}</Typography>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>{data.department}</Typography>
          
          <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
            {data.expertise && <Chip label={data.expertise} variant="outlined" />}
            {data.experienceYears && <Chip label={`${data.experienceYears} Years Exp`} variant="outlined" />}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>Bio</Typography>
              <Typography variant="body1">{data.bio || 'No bio provided.'}</Typography>
            </Box>
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>Office Location</Typography>
                <Typography variant="body2">{data.officeLocation || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>Availability</Typography>
                <Typography variant="body2">{data.availability || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>Contact Preference</Typography>
                <Typography variant="body2">{data.contactPreference || '—'}</Typography>
              </Box>
            </Stack>

            {data.linkedIn && (
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>LinkedIn / Profile</Typography>
                <Typography variant="body2" component="a" href={data.linkedIn} target="_blank" rel="noopener noreferrer">
                  {data.linkedIn}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};

export default MentorProfileView;
