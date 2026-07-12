/**
 * Repositories Endpoint
 * CRUD operations for managing repositories.
 */

import { Router } from 'express';
import { getDb } from '../services/firebase.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/v1/repos - List user's repositories
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('repositories')
      .where('userId', '==', req.user.uid)
      .get();

    const repos = snapshot.docs.map(doc => {
      const data = doc.data();
      // Don't send the full coverageMap in list view
      const { coverageMap, ...rest } = data;
      return {
        ...rest,
        hasCoverageMap: !!coverageMap,
      };
    });

    // Sort in-memory: newest repositories first
    repos.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB - dateA;
    });

    res.json({ repositories: repos });
  } catch (error) {
    console.error('List repos error:', error);
    res.status(500).json({ error: 'Failed to list repositories', message: error.message });
  }
});

// GET /api/v1/repos/:repoId - Get single repository
router.get('/:repoId', async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection('repositories').doc(req.params.repoId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const data = doc.data();

    // Verify ownership
    if (data.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { coverageMap, ...rest } = data;
    res.json({
      ...rest,
      hasCoverageMap: !!coverageMap,
      coverageMapSize: coverageMap ? Object.keys(coverageMap).length : 0,
    });
  } catch (error) {
    console.error('Get repo error:', error);
    res.status(500).json({ error: 'Failed to get repository', message: error.message });
  }
});

// POST /api/v1/repos - Create a new repository
router.post('/', async (req, res) => {
  try {
    const { repoName } = req.body;

    if (!repoName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'repoName is required.',
      });
    }

    const db = getDb();
    const repoId = uuidv4();

    const repoData = {
      repoId,
      userId: req.user.uid,
      repoName,
      baselineHash: null,
      coverageMap: null,
      totalTests: 0,
      avgSuiteTime: 0,
      totalRuns: 0,
      totalTimeSaved: 0,
      avgOptimization: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('repositories').doc(repoId).set(repoData);

    res.status(201).json({
      repoId,
      message: 'Repository created successfully.',
      ...repoData,
    });
  } catch (error) {
    console.error('Create repo error:', error);
    res.status(500).json({ error: 'Failed to create repository', message: error.message });
  }
});

// DELETE /api/v1/repos/:repoId - Delete a repository
router.delete('/:repoId', async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection('repositories').doc(req.params.repoId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    if (doc.data().userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.collection('repositories').doc(req.params.repoId).delete();

    res.json({ message: 'Repository deleted successfully.' });
  } catch (error) {
    console.error('Delete repo error:', error);
    res.status(500).json({ error: 'Failed to delete repository', message: error.message });
  }
});

export default router;
