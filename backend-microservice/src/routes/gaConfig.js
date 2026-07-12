/**
 * GA Configuration Endpoint
 * Manages per-repo Genetic Algorithm tuning parameters.
 * 
 * GET  /api/v1/ga-config/:repoId             — Fetch GA config for a repo
 * PUT  /api/v1/ga-config/:repoId             — Save GA config for a repo
 * GET  /api/v1/ga-config/:repoId/evolution/:runId — Fetch evolution data for a specific run
 */

import { Router } from 'express';
import { getDb } from '../services/firebase.js';

const router = Router();

// Default GA configuration
const GA_DEFAULTS = {
  populationSize: 100,
  maxGenerations: 100,
  mutationRate: 0.02,
  timeLimitMs: 3000,
  stagnationLimit: 15,
  elitismRate: 0.05,
  tournamentSize: 5,
  alpha: 0.7,
  beta: 0.3,
  coveragePenalty: -1000,
};

// GET /api/v1/ga-config/:repoId — Fetch per-repo GA config
router.get('/:repoId', async (req, res) => {
  try {
    const db = getDb();
    const { repoId } = req.params;

    // Verify repo ownership
    const repoDoc = await db.collection('repositories').doc(repoId).get();
    if (!repoDoc.exists) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    if (repoDoc.data().userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Look for user's custom GA config
    const configDoc = await db.collection('gaConfigs').doc(repoId).get();

    if (configDoc.exists) {
      const config = configDoc.data();
      res.json({
        ...GA_DEFAULTS,
        ...config,
        isCustom: true,
      });
    } else {
      res.json({
        ...GA_DEFAULTS,
        isCustom: false,
      });
    }
  } catch (error) {
    console.error('Get GA config error:', error);
    res.status(500).json({ error: 'Failed to fetch GA config', message: error.message });
  }
});

// PUT /api/v1/ga-config/:repoId — Save per-repo GA config
router.put('/:repoId', async (req, res) => {
  try {
    const db = getDb();
    const { repoId } = req.params;

    // Verify repo ownership
    const repoDoc = await db.collection('repositories').doc(repoId).get();
    if (!repoDoc.exists) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    if (repoDoc.data().userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate and sanitize config values
    const allowedFields = [
      'populationSize', 'maxGenerations', 'mutationRate', 'timeLimitMs',
      'stagnationLimit', 'elitismRate', 'tournamentSize', 'alpha', 'beta',
      'coveragePenalty',
    ];

    const config = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        config[field] = Number(req.body[field]);
      }
    }

    // Validate ranges
    if (config.populationSize !== undefined && (config.populationSize < 10 || config.populationSize > 500)) {
      return res.status(400).json({ error: 'populationSize must be between 10 and 500' });
    }
    if (config.maxGenerations !== undefined && (config.maxGenerations < 10 || config.maxGenerations > 500)) {
      return res.status(400).json({ error: 'maxGenerations must be between 10 and 500' });
    }
    if (config.mutationRate !== undefined && (config.mutationRate < 0.001 || config.mutationRate > 0.1)) {
      return res.status(400).json({ error: 'mutationRate must be between 0.001 and 0.1' });
    }
    if (config.timeLimitMs !== undefined && (config.timeLimitMs < 500 || config.timeLimitMs > 10000)) {
      return res.status(400).json({ error: 'timeLimitMs must be between 500 and 10000' });
    }
    if (config.alpha !== undefined && (config.alpha < 0.1 || config.alpha > 1.0)) {
      return res.status(400).json({ error: 'alpha must be between 0.1 and 1.0' });
    }
    if (config.beta !== undefined && (config.beta < 0.1 || config.beta > 1.0)) {
      return res.status(400).json({ error: 'beta must be between 0.1 and 1.0' });
    }
    if (config.coveragePenalty !== undefined && (config.coveragePenalty < -10000 || config.coveragePenalty > -10)) {
      return res.status(400).json({ error: 'coveragePenalty must be between -10000 and -10' });
    }

    config.userId = req.user.uid;
    config.updatedAt = new Date();

    await db.collection('gaConfigs').doc(repoId).set(config, { merge: true });

    res.json({
      message: 'GA configuration saved successfully',
      config: { ...GA_DEFAULTS, ...config },
    });
  } catch (error) {
    console.error('Save GA config error:', error);
    res.status(500).json({ error: 'Failed to save GA config', message: error.message });
  }
});

// GET /api/v1/ga-config/:repoId/evolution/:runId — Fetch evolution data for a run
router.get('/:repoId/evolution/:runId', async (req, res) => {
  try {
    const db = getDb();
    const { repoId, runId } = req.params;

    const telemetryDoc = await db.collection('telemetry').doc(runId).get();
    if (!telemetryDoc.exists) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const data = telemetryDoc.data();
    if (data.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      runId,
      repoId: data.repoId,
      evolutionData: data.evolutionData || [],
      selectedTests: data.selectedTests || [],
      gaGenerations: data.gaGenerations || 0,
      gaBestFitness: data.gaBestFitness || 0,
      testsSelected: data.testsSelected || 0,
      totalTests: data.totalTests || 0,
      convergenceReason: data.convergenceReason || 'unknown',
      diffSummary: data.diffSummary || {},
      timestamp: data.timestamp,
    });
  } catch (error) {
    console.error('Get evolution data error:', error);
    res.status(500).json({ error: 'Failed to fetch evolution data', message: error.message });
  }
});

export default router;
