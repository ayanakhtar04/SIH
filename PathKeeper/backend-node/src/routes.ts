import { Router } from 'express';

import { users } from './users/seed';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'pathkeepers-backend',
    usersSeeded: users.length,
    timestamp: new Date().toISOString()
  });
});

export default router;
