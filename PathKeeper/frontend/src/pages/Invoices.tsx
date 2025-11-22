import React from 'react';
import { Box, Typography } from '@mui/material';

const Invoices: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>Invoices</Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        Coming soon: billing & fees dashboard.
      </Typography>
    </Box>
  );
};

export default Invoices;
