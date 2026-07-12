/**
 * Baseline Endpoint
 * POST /api/v1/baseline
 * 
 * Accepts the master coverage map generated during Cold Start.
 * Stores/updates it in Firestore for the repository.
 */

import { Router } from 'express';
import { getDb } from '../services/firebase.js';
import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { repoId, repoName, coverageMap, totalTests, avgSuiteTime } = req.body;

    // Validate required fields
    if (!coverageMap) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'coverageMap is required.',
      });
    }

    const db = getDb();

    // Generate hash of coverage map for change detection
    const coverageString = JSON.stringify(coverageMap);
    const baselineHash = createHash('md5').update(coverageString).digest('hex');

    const resolvedRepoId = repoId || uuidv4();
    const repoRef = db.collection('repositories').doc(resolvedRepoId);
    const existingRepo = await repoRef.get();

    if (existingRepo.exists) {
      // Update existing repository
      await repoRef.update({
        coverageMap,
        baselineHash,
        totalTests: totalTests || Object.keys(coverageMap).length,
        avgSuiteTime: avgSuiteTime || 0,
        updatedAt: new Date(),
      });
    } else {
      // Create new repository
      await repoRef.set({
        repoId: resolvedRepoId,
        userId: req.user.uid,
        repoName: repoName || 'Unnamed Repository',
        coverageMap,
        baselineHash,
        totalTests: totalTests || Object.keys(coverageMap).length,
        avgSuiteTime: avgSuiteTime || 0,
        totalRuns: 0,
        totalTimeSaved: 0,
        avgOptimization: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    res.status(201).json({
      repoId: resolvedRepoId,
      baselineHash,
      totalTests: totalTests || Object.keys(coverageMap).length,
      message: 'Baseline coverage map stored successfully.',
    });
  } catch (error) {
    console.error('Baseline endpoint error:', error);
    res.status(500).json({
      error: 'Baseline storage failed',
      message: error.message,
    });
  }
});

// GET baseline hash for a repository (used by CLI to check if re-baseline is needed)
router.get('/:repoId', async (req, res) => {
  try {
    const db = getDb();
    const repoDoc = await db.collection('repositories').doc(req.params.repoId).get();

    if (!repoDoc.exists) {
      return res.status(404).json({
        error: 'Repository not found',
        message: 'No baseline exists for this repository. Run `smart-test init` first.',
      });
    }

    const data = repoDoc.data();
    res.json({
      repoId: req.params.repoId,
      baselineHash: data.baselineHash,
      totalTests: data.totalTests,
      updatedAt: data.updatedAt,
    });
  } catch (error) {
    console.error('Baseline GET error:', error);
    res.status(500).json({ error: 'Failed to retrieve baseline', message: error.message });
  }
});

export default router;
