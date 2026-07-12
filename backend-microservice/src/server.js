/**
 * TIA Optimizer Backend - Express Server Entry Point
 * 
 * Stateless optimization microservice that houses the Genetic Algorithm
 * engine and manages Firestore data persistence.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { initializeFirebase } from './services/firebase.js';
import { verifyToken, flexibleAuth } from './middleware/auth.js';

import healthRouter from './routes/health.js';
import optimizeRouter from './routes/optimize.js';
import telemetryRouter from './routes/telemetry.js';
import baselineRouter from './routes/baseline.js';
import reposRouter from './routes/repos.js';
import dashboardRouter from './routes/dashboard.js';
import authRouter from './routes/auth.js';
import gaConfigRouter from './routes/gaConfig.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== MIDDLEWARE ====================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS - allow frontend dev server
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Body parsing (50MB limit for large coverage maps)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Compression
app.use(compression());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/v1/health') {
      console.log(
        `${req.method} ${req.path} ${res.statusCode} ${duration}ms`
      );
    }
  });
  next();
});

// ==================== ROUTES ====================

// Public routes (no auth required)
app.use('/api/v1/health', healthRouter);

// Auth routes (Firebase token required)
app.use('/api/v1/auth', verifyToken, authRouter);

// Dashboard routes (Firebase token required)
app.use('/api/v1/dashboard', verifyToken, dashboardRouter);
app.use('/api/v1/repos', verifyToken, reposRouter);
app.use('/api/v1/ga-config', verifyToken, gaConfigRouter);

// CLI routes (API key or Firebase token)
app.use('/api/v1/optimize', flexibleAuth, optimizeRouter);
app.use('/api/v1/telemetry', flexibleAuth, telemetryRouter);
app.use('/api/v1/baseline', flexibleAuth, baselineRouter);

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist.`,
    availableEndpoints: [
      'GET  /api/v1/health',
      'POST /api/v1/optimize',
      'POST /api/v1/telemetry',
      'POST /api/v1/baseline',
      'GET  /api/v1/repos',
      'GET  /api/v1/dashboard/metrics',
    ],
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.',
  });
});

// ==================== START SERVER ====================

async function startServer() {
  try {
    // Initialize Firebase
    initializeFirebase();

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🧬 TIA Optimizer Backend v1.0.0                    ║
║   ────────────────────────────────────────────────   ║
║   Status:      Running                               ║
║   Port:        ${String(PORT).padEnd(38)}║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(38)}║
║   Firebase:    Connected                             ║
║                                                      ║
║   Endpoints:                                         ║
║   • Health:    GET  /api/v1/health                   ║
║   • Optimize:  POST /api/v1/optimize                 ║
║   • Telemetry: POST /api/v1/telemetry                ║
║   • Baseline:  POST /api/v1/baseline                 ║
║   • Repos:     GET  /api/v1/repos                    ║
║   • Dashboard: GET  /api/v1/dashboard/metrics        ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
