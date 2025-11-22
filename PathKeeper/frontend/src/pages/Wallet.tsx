import React from 'react';
import { Box, Typography } from '@mui/material';

const Wallet: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>Wallet</Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        Coming soon: payment methods and transactions.
      </Typography>
    </Box>
  );
};

export default Wallet;
