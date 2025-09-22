import { Router } from 'express';

import { authRequired, AuthedRequest } from './auth/middleware';

const mlRouter = Router();

// Mock predict endpoint (public for now – can secure later if desired)
mlRouter.post('/predict', (req, res) => {
  const { features } = req.body || {};
  // features ignored in mock; in future we forward to Python service
  const riskScore = 0.42; // placeholder
  const label = riskScore > 0.7 ? 'HIGH' : riskScore > 0.4 ? 'MEDIUM' : 'LOW';
  return res.json({
    ok: true,
    prediction: {
      riskScore,
      label,
      factors: [
        { key: 'attendance_drop', weight: 0.3 },
        { key: 'low_assignments', weight: 0.2 },
        { key: 'engagement_score', weight: -0.1 }
      ],
      receivedFeatures: Array.isArray(features) ? features.length : 0
    }
  });
});

// Protected train endpoint (scaffold)
mlRouter.post('/train', authRequired, (req: AuthedRequest, res) => {
  const version = 'mock-1';
  // In real impl: enqueue training job -> return job id
  return res.json({ ok: true, started: true, modelVersion: version, initiatedBy: req.user?.email });
});

export default mlRouter;
