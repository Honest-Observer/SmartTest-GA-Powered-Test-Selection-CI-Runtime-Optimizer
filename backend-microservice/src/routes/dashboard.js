/**
 * Dashboard Endpoint
 * Aggregated metrics and telemetry for the frontend dashboard.
 */

import { Router } from 'express';
import { getDb } from '../services/firebase.js';

const router = Router();

// GET /api/v1/dashboard/metrics - Aggregated user stats
router.get('/metrics', async (req, res) => {
  try {
    const db = getDb();

    // Get user's repositories
    const reposSnapshot = await db.collection('repositories')
      .where('userId', '==', req.user.uid)
      .get();

    const repos = reposSnapshot.docs.map(doc => doc.data());

    // Aggregate metrics
    let totalTimeSaved = 0;
    let totalRuns = 0;
    let totalTests = 0;
    let avgOptimization = 0;

    for (const repo of repos) {
      totalTimeSaved += repo.totalTimeSaved || 0;
      totalRuns += repo.totalRuns || 0;
      totalTests += repo.totalTests || 0;
      avgOptimization += repo.avgOptimization || 0;
    }

    if (repos.length > 0) {
      avgOptimization = avgOptimization / repos.length;
    }

    res.json({
      totalTimeSaved: parseFloat(totalTimeSaved.toFixed(1)),
      totalTimeSavedHours: parseFloat((totalTimeSaved / 3600).toFixed(1)),
      totalRuns,
      activeRepos: repos.length,
      totalTests,
      avgOptimization: parseFloat(avgOptimization.toFixed(1)),
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics', message: error.message });
  }
});

// GET /api/v1/dashboard/telemetry/:repoId - Time-series data for charts
router.get('/telemetry/:repoId', async (req, res) => {
  try {
    const db = getDb();
    const { repoId } = req.params;
    const { limit: queryLimit = 50 } = req.query;

    const snapshot = await db.collection('telemetry')
      .where('repoId', '==', repoId)
      .where('userId', '==', req.user.uid)
      .get();

    let telemetry = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        runId: data.runId,
        naiveTimeSec: data.naiveTimeSec,
        gaTimeSec: data.gaTimeSec,
        testsSelected: data.testsSelected,
        totalTests: data.totalTests,
        timeSaved: data.timeSaved,
        coverageRatio: data.coverageRatio,
        gaGenerations: data.gaGenerations,
        exitCode: data.exitCode,
        timestamp: data.timestamp,
      };
    });

    // Sort in-memory: oldest to newest (chronological order for charts)
    telemetry.sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateA - dateB;
    });

    // Apply limit
    if (telemetry.length > parseInt(queryLimit)) {
      telemetry = telemetry.slice(telemetry.length - parseInt(queryLimit));
    }

    res.json({ telemetry });
  } catch (error) {
    console.error('Dashboard telemetry error:', error);
    res.status(500).json({ error: 'Failed to fetch telemetry', message: error.message });
  }
});

// GET /api/v1/dashboard/latest/:repoId - Latest run details
router.get('/latest/:repoId', async (req, res) => {
  try {
    const db = getDb();
    const { repoId } = req.params;

    const snapshot = await db.collection('telemetry')
      .where('repoId', '==', repoId)
      .where('userId', '==', req.user.uid)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        error: 'No runs found',
        message: 'No telemetry data exists for this repository yet.',
      });
    }

    const runs = snapshot.docs.map(doc => doc.data());
    
    // Sort in-memory: newest run first
    runs.sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateB - dateA;
    });

    res.json(runs[0]);
  } catch (error) {
    console.error('Dashboard latest error:', error);
    res.status(500).json({ error: 'Failed to fetch latest run', message: error.message });
  }
});

// GET /api/v1/dashboard/recent - Recent runs across all repos
router.get('/recent', async (req, res) => {
  try {
    const db = getDb();
    const { limit: queryLimit = 20 } = req.query;

    const snapshot = await db.collection('telemetry')
      .where('userId', '==', req.user.uid)
      .get();

    let runs = snapshot.docs.map(doc => doc.data());

    // Sort in-memory: newest runs first
    runs.sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateB - dateA;
    });

    // Slice to limit
    runs = runs.slice(0, parseInt(queryLimit));

    const enrichedRuns = [];
    for (const data of runs) {
      // Look up repo name
      const repoDoc = await db.collection('repositories').doc(data.repoId).get();
      enrichedRuns.push({
        ...data,
        repoName: repoDoc.exists ? repoDoc.data().repoName : 'Unknown',
      });
    }

    res.json({ runs: enrichedRuns });
  } catch (error) {
    console.error('Dashboard recent error:', error);
    res.status(500).json({ error: 'Failed to fetch recent runs', message: error.message });
  }
});

export default router;
