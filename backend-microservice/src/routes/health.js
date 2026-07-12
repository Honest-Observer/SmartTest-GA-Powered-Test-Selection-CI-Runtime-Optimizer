/**
 * Health Check Endpoint
 * GET /api/v1/health
 * 
 * Standard health-check for load balancers and monitoring.
 */

import { Router } from 'express';

const router = Router();
const startTime = Date.now();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TIA Optimizer Backend',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;
