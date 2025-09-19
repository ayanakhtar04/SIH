import React from 'react';
import { Box, Typography } from '@mui/material';

const Notifications: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>Notifications</Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        Coming soon: alerts & updates.
      </Typography>
    </Box>
  );
};

export default Notifications;
