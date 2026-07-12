/**
 * Optimize Endpoint
 * POST /api/v1/optimize
 * 
 * The primary operational endpoint. Receives diff matrix and
 * intersecting tests, runs GA in worker thread, returns optimized test subset.
 */

import { Router } from 'express';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { greedyOptimize } from '../engine/greedy.js';
import { getDb } from '../services/firebase.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKER_TIMEOUT = 3500; // 3.5s total timeout (GA has 3s internal limit)

router.post('/', async (req, res) => {
  const startTime = performance.now();

  try {
    const { repoId, diffMatrix, intersectingTests, coverageMap, testTimes } = req.body;

    // Validate required fields
    if (!repoId || !diffMatrix || !intersectingTests) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'repoId, diffMatrix, and intersectingTests are required.',
      });
    }

    // Extract modified lines from diffMatrix
    // diffMatrix: { "src/auth.js": [10, 15, 22], "src/user.js": [5, 8] }
    const modifiedLines = [];
    for (const [file, lines] of Object.entries(diffMatrix)) {
      for (const line of lines) {
        modifiedLines.push(`${file}:${line}`);
      }
    }

    // Build coverage matrix from intersecting tests
    // intersectingTests: { "auth.test.js": { coveredFiles: { "src/auth.js": [10, 15, 20, 22] } }, ... }
    const testIds = Object.keys(intersectingTests);
    const coverageMatrix = {};
    const resolvedTestTimes = {};

    for (const testId of testIds) {
      const testInfo = intersectingTests[testId];
      const coveredLines = [];

      if (testInfo.coveredFiles) {
        for (const [file, lines] of Object.entries(testInfo.coveredFiles)) {
          for (const line of lines) {
            coveredLines.push(`${file}:${line}`);
          }
        }
      }

      coverageMatrix[testId] = coveredLines;
      resolvedTestTimes[testId] = testInfo.estimatedTime || (testTimes && testTimes[testId]) || 2.0;
    }

    // Edge case: no tests to optimize
    if (testIds.length === 0) {
      return res.json({
        selectedTests: [],
        metadata: {
          totalTests: 0,
          selectedCount: 0,
          modifiedLines: modifiedLines.length,
          coverageRatio: 1.0,
          gaGenerations: 0,
          convergenceReason: 'no_tests',
          timeTakenMs: 0,
          evolutionData: [],
        },
      });
    }

    // Edge case: 1 or fewer tests — just run them all (no GA needed)
    if (testIds.length <= 1) {
      return res.json({
        selectedTests: testIds,
        metadata: {
          totalTests: testIds.length,
          selectedCount: testIds.length,
          modifiedLines: modifiedLines.length,
          coverageRatio: 1.0,
          gaGenerations: 0,
          convergenceReason: 'trivial_size',
          timeTakenMs: parseFloat((performance.now() - startTime).toFixed(2)),
          evolutionData: [],
        },
      });
    }

    const gaPayload = {
      testIds,
      coverageMatrix,
      modifiedLines,
      testTimes: resolvedTestTimes,
    };

    const gaConfig = {
      populationSize: parseInt(process.env.GA_POPULATION_SIZE) || 100,
      maxGenerations: parseInt(process.env.GA_MAX_GENERATIONS) || 100,
      mutationRate: parseFloat(process.env.GA_MUTATION_RATE) || 0.02,
      timeLimitMs: parseInt(process.env.GA_TIME_LIMIT_MS) || 3000,
      stagnationLimit: parseInt(process.env.GA_STAGNATION_LIMIT) || 15,
      elitismRate: parseFloat(process.env.GA_ELITISM_RATE) || 0.05,
      tournamentSize: parseInt(process.env.GA_TOURNAMENT_SIZE) || 5,
    };

    // Load per-repo custom GA config from Firestore (overrides env defaults)
    try {
      const db = getDb();
      const configDoc = await db.collection('gaConfigs').doc(repoId).get();
      if (configDoc.exists) {
        const custom = configDoc.data();
        if (custom.populationSize) gaConfig.populationSize = custom.populationSize;
        if (custom.maxGenerations) gaConfig.maxGenerations = custom.maxGenerations;
        if (custom.mutationRate) gaConfig.mutationRate = custom.mutationRate;
        if (custom.timeLimitMs) gaConfig.timeLimitMs = custom.timeLimitMs;
        if (custom.stagnationLimit) gaConfig.stagnationLimit = custom.stagnationLimit;
        if (custom.elitismRate) gaConfig.elitismRate = custom.elitismRate;
        if (custom.tournamentSize) gaConfig.tournamentSize = custom.tournamentSize;
        if (custom.alpha) gaConfig.alpha = custom.alpha;
        if (custom.beta) gaConfig.beta = custom.beta;
        if (custom.coveragePenalty) gaConfig.coveragePenalty = custom.coveragePenalty;
        console.log(`Using custom GA config for repo ${repoId}`);
      }
    } catch (err) {
      console.warn('Failed to load custom GA config, using defaults:', err.message);
    }

    // Run greedy algorithm in parallel as fallback
    const greedyResult = greedyOptimize(gaPayload);

    // Spawn worker thread for GA
    const gaResult = await new Promise((resolve, reject) => {
      const workerPath = join(__dirname, '..', 'engine', 'worker.js');
      const worker = new Worker(workerPath, {
        workerData: { payload: gaPayload, config: gaConfig },
      });

      const timeout = setTimeout(() => {
        worker.terminate();
        resolve(null); // Timeout — will use greedy fallback
      }, WORKER_TIMEOUT);

      worker.on('message', (msg) => {
        clearTimeout(timeout);
        if (msg.success) {
          resolve(msg.result);
        } else {
          console.error('GA worker error:', msg.error);
          resolve(null); // Error — will use greedy fallback
        }
        worker.terminate();
      });

      worker.on('error', (err) => {
        clearTimeout(timeout);
        console.error('GA worker crash:', err.message);
        resolve(null);
      });
    });

    // Use GA result if it's better than greedy, otherwise use greedy
    let result;
    let engine;

    if (gaResult && gaResult.coverageRatio >= greedyResult.coverageRatio) {
      // GA found equal or better coverage — prefer it if it's also faster
      if (gaResult.selectedTests.length <= greedyResult.selectedTests.length) {
        result = gaResult;
        engine = 'genetic_algorithm';
      } else {
        result = gaResult; // GA has better coverage even if more tests
        engine = 'genetic_algorithm';
      }
    } else if (gaResult) {
      // GA result exists but greedy has better coverage
      result = {
        selectedTests: greedyResult.selectedTests,
        generations: gaResult.generations,
        bestFitness: gaResult.bestFitness,
        coverageRatio: greedyResult.coverageRatio,
        estimatedTime: greedyResult.estimatedTime,
        evolutionData: gaResult.evolutionData,
        convergenceReason: 'greedy_fallback',
        timeTakenMs: gaResult.timeTakenMs,
      };
      engine = 'greedy_fallback';
    } else {
      // GA failed entirely — use greedy
      result = {
        selectedTests: greedyResult.selectedTests,
        generations: 0,
        bestFitness: 0,
        coverageRatio: greedyResult.coverageRatio,
        estimatedTime: greedyResult.estimatedTime,
        evolutionData: [],
        convergenceReason: 'ga_timeout',
        timeTakenMs: greedyResult.timeTakenMs,
      };
      engine = 'greedy_fallback';
    }

    const totalTimeTaken = parseFloat((performance.now() - startTime).toFixed(2));

    res.json({
      selectedTests: result.selectedTests,
      metadata: {
        engine,
        totalTests: testIds.length,
        selectedCount: result.selectedTests.length,
        modifiedLines: modifiedLines.length,
        coverageRatio: result.coverageRatio,
        estimatedTime: result.estimatedTime,
        gaGenerations: result.generations || 0,
        gaBestFitness: result.bestFitness || 0,
        convergenceReason: result.convergenceReason,
        timeTakenMs: totalTimeTaken,
        evolutionData: result.evolutionData || [],
      },
    });
  } catch (error) {
    console.error('Optimize endpoint error:', error);
    res.status(500).json({
      error: 'Optimization failed',
      message: error.message,
    });
  }
});

export default router;
