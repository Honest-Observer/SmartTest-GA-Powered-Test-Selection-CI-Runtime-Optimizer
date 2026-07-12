/**
 * Telemetry Endpoint
 * POST /api/v1/telemetry
 * 
 * Accepts post-execution metrics from the CLI tool.
 * Stores run data in Firestore for dashboard visualization.
 */

import { Router } from 'express';
import { getDb } from '../services/firebase.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const {
      repoId,
      naiveTimeSec,
      gaTimeSec,
      testsSelected,
      totalTests,
      exitCode,
      gaGenerations,
      gaBestFitness,
      evolutionData,
      selectedTests,
      diffSummary,
      coverageRatio,
    } = req.body;

    // Validate required fields
    if (!repoId || naiveTimeSec === undefined || gaTimeSec === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'repoId, naiveTimeSec, and gaTimeSec are required.',
      });
    }

    const db = getDb();
    const runId = uuidv4();

    const telemetryRecord = {
      runId,
      repoId,
      userId: req.user.uid,
      naiveTimeSec: Number(naiveTimeSec) || 0,
      gaTimeSec: Number(gaTimeSec) || 0,
      testsSelected: Number(testsSelected) || 0,
      totalTests: Number(totalTests) || 0,
      exitCode: Number(exitCode) || 0,
      gaGenerations: Number(gaGenerations) || 0,
      gaBestFitness: Number(gaBestFitness) || 0,
      coverageRatio: Number(coverageRatio) || 1.0,
      evolutionData: evolutionData || [],
      selectedTests: selectedTests || [],
      diffSummary: diffSummary || {},
      timestamp: new Date(),
      timeSaved: Math.max(0, Number(naiveTimeSec) - Number(gaTimeSec)),
    };

    await db.collection('telemetry').doc(runId).set(telemetryRecord);

    // Update repository's aggregate stats
    const repoRef = db.collection('repositories').doc(repoId);
    const repoDoc = await repoRef.get();

    if (repoDoc.exists) {
      const repoData = repoDoc.data();
      await repoRef.update({
        totalRuns: (repoData.totalRuns || 0) + 1,
        totalTimeSaved: (repoData.totalTimeSaved || 0) + telemetryRecord.timeSaved,
        lastRunAt: new Date(),
        avgOptimization: repoData.totalRuns
          ? (((repoData.avgOptimization || 0) * repoData.totalRuns) + 
             (telemetryRecord.timeSaved / Math.max(telemetryRecord.naiveTimeSec, 1) * 100)) / 
            (repoData.totalRuns + 1)
          : (telemetryRecord.timeSaved / Math.max(telemetryRecord.naiveTimeSec, 1) * 100),
      });
    }

    res.status(201).json({
      runId,
      message: 'Telemetry recorded successfully',
      timeSaved: telemetryRecord.timeSaved,
    });
  } catch (error) {
    console.error('Telemetry endpoint error:', error);
    res.status(500).json({
      error: 'Telemetry recording failed',
      message: error.message,
    });
  }
});

export default router;
