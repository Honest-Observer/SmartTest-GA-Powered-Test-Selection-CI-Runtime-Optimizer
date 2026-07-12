/**
 * Seed Script - Populate Firestore with realistic demo data
 * 
 * Usage: npm run seed
 * 
 * Creates demo user, repositories, and telemetry data
 * so the dashboard looks impressive immediately.
 */

import 'dotenv/config';
import { initializeFirebase, getDb } from './services/firebase.js';
import { generateApiKey, hashApiKey } from './utils/apiKey.js';
import { v4 as uuidv4 } from 'uuid';

const DEMO_USER_ID = 'demo-user-001';

async function seed() {
  console.log('🌱 Seeding Firestore with demo data...\n');

  initializeFirebase();
  const db = getDb();

  // 1. Create demo user
  console.log('  Creating demo user...');
  const apiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(apiKey);

  await db.collection('users').doc(DEMO_USER_ID).set({
    uid: DEMO_USER_ID,
    email: 'demo@tia-optimizer.dev',
    displayName: 'Demo Engineer',
    photoURL: '',
    apiKeyHash,
    apiKeyPrefix: apiKey.substring(0, 12) + '...',
    apiKeyUpdatedAt: new Date(),
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastLoginAt: new Date(),
  });

  // Store API key hash for lookup
  await db.collection('apiKeys').doc(uuidv4()).set({
    userId: DEMO_USER_ID,
    keyHash: apiKeyHash,
    active: true,
    createdAt: new Date(),
  });

  // 2. Create demo repositories
  console.log('  Creating demo repositories...');
  const repos = [
    {
      repoId: 'repo-frontend-webapp',
      repoName: 'frontend-web-app',
      totalTests: 1847,
      avgSuiteTime: 2700, // 45 minutes
    },
    {
      repoId: 'repo-api-gateway',
      repoName: 'api-gateway-service',
      totalTests: 523,
      avgSuiteTime: 480, // 8 minutes
    },
    {
      repoId: 'repo-auth-service',
      repoName: 'auth-microservice',
      totalTests: 312,
      avgSuiteTime: 180, // 3 minutes
    },
    {
      repoId: 'repo-payment-engine',
      repoName: 'payment-processing-engine',
      totalTests: 2104,
      avgSuiteTime: 3600, // 60 minutes
    },
    {
      repoId: 'repo-data-pipeline',
      repoName: 'data-pipeline-etl',
      totalTests: 891,
      avgSuiteTime: 1200, // 20 minutes
    },
  ];

  // Generate a realistic coverage map for each repo
  function generateCoverageMap(totalTests) {
    const coverageMap = {};
    const files = [
      'src/auth/login.ts', 'src/auth/register.ts', 'src/auth/oauth.ts',
      'src/models/user.ts', 'src/models/session.ts', 'src/models/role.ts',
      'src/api/routes.ts', 'src/api/middleware.ts', 'src/api/validation.ts',
      'src/services/email.ts', 'src/services/cache.ts', 'src/services/queue.ts',
      'src/utils/crypto.ts', 'src/utils/logger.ts', 'src/utils/parser.ts',
      'src/controllers/user.ts', 'src/controllers/admin.ts',
      'src/database/queries.ts', 'src/database/migrations.ts',
    ];

    const testCount = Math.min(totalTests, 200); // Limit coverage map size for seed data
    for (let i = 0; i < testCount; i++) {
      const testName = `test_${String(i).padStart(3, '0')}_${files[i % files.length].split('/').pop().replace('.ts', '')}`;
      const coveredFiles = {};

      // Each test covers 1-4 source files
      const numFiles = 1 + Math.floor(Math.random() * 4);
      for (let f = 0; f < numFiles; f++) {
        const file = files[(i + f) % files.length];
        const lineCount = 5 + Math.floor(Math.random() * 30);
        const startLine = Math.floor(Math.random() * 200);
        coveredFiles[file] = Array.from({ length: lineCount }, (_, k) => startLine + k);
      }

      coverageMap[testName] = { coveredFiles, estimatedTime: 0.5 + Math.random() * 5 };
    }

    return coverageMap;
  }

  for (const repo of repos) {
    const coverageMap = generateCoverageMap(repo.totalTests);
    const totalRuns = 50 + Math.floor(Math.random() * 400);
    const totalTimeSaved = totalRuns * (repo.avgSuiteTime * 0.85); // ~85% time saved per run

    await db.collection('repositories').doc(repo.repoId).set({
      ...repo,
      userId: DEMO_USER_ID,
      coverageMap,
      baselineHash: uuidv4().replace(/-/g, '').substring(0, 32),
      totalRuns,
      totalTimeSaved,
      avgOptimization: 82 + Math.random() * 15,
      createdAt: new Date(Date.now() - (60 + Math.random() * 30) * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      lastRunAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
    });
  }

  // 3. Create demo telemetry data
  console.log('  Creating demo telemetry records...');
  const batch = db.batch();
  let batchCount = 0;

  for (const repo of repos) {
    const numRuns = 15 + Math.floor(Math.random() * 15);

    for (let i = 0; i < numRuns; i++) {
      const runId = uuidv4();
      const naiveTime = repo.avgSuiteTime * (0.8 + Math.random() * 0.4);
      const optimizationRatio = 0.03 + Math.random() * 0.15; // 3-18% of original time
      const gaTime = naiveTime * optimizationRatio;
      const testsSelected = Math.floor(repo.totalTests * optimizationRatio * (1.5 + Math.random()));

      // Generate evolution data (realistic convergence curve)
      const generations = 30 + Math.floor(Math.random() * 50);
      const evolutionData = [];
      let bestFitness = 0.05 + Math.random() * 0.15;
      let avgFitness = bestFitness * 0.3;

      for (let g = 0; g < generations; g++) {
        const progress = g / generations;
        // Logarithmic convergence curve
        bestFitness = 0.05 + 0.6 * (1 - Math.exp(-5 * progress)) + Math.random() * 0.02;
        avgFitness = bestFitness * (0.4 + 0.4 * progress) + Math.random() * 0.05;

        evolutionData.push({
          generation: g,
          bestFitness: parseFloat(bestFitness.toFixed(4)),
          avgFitness: parseFloat(Math.min(avgFitness, bestFitness - 0.01).toFixed(4)),
        });
      }

      const timestamp = new Date(Date.now() - (numRuns - i) * (24 * 60 * 60 * 1000 * Math.random() * 3));

      const telemetryDoc = {
        runId,
        repoId: repo.repoId,
        userId: DEMO_USER_ID,
        naiveTimeSec: parseFloat(naiveTime.toFixed(1)),
        gaTimeSec: parseFloat(gaTime.toFixed(1)),
        testsSelected,
        totalTests: repo.totalTests,
        exitCode: Math.random() > 0.05 ? 0 : 1, // 95% success rate
        gaGenerations: generations,
        gaBestFitness: parseFloat(bestFitness.toFixed(4)),
        coverageRatio: 1.0,
        evolutionData,
        selectedTests: Array.from({ length: testsSelected }, (_, k) => `test_${String(k).padStart(3, '0')}`),
        diffSummary: {
          filesChanged: 1 + Math.floor(Math.random() * 8),
          linesChanged: 5 + Math.floor(Math.random() * 100),
        },
        timeSaved: parseFloat((naiveTime - gaTime).toFixed(1)),
        timestamp,
      };

      batch.set(db.collection('telemetry').doc(runId), telemetryDoc);
      batchCount++;

      // Firestore batch limit is 500
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n✅ Seed complete!`);
  console.log(`   • 1 demo user created`);
  console.log(`   • ${repos.length} repositories created`);
  console.log(`   • Multiple telemetry records created`);
  console.log(`\n   Demo API Key: ${apiKey}`);
  console.log(`   (Use this key with: smart-test init ${apiKey})\n`);

  process.exit(0);
}

seed().catch(error => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
