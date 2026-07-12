/**
 * Run Command — Main Optimization Flow
 * 
 * 1. Parse git diff to find modified files/lines
 * 2. Load local coverage map
 * 3. Intersect diff with coverage (client-side pre-processing)
 * 4. Send minimal payload to backend GA optimizer
 * 5. Receive optimized test subset
 * 6. Execute targeted tests locally
 * 7. Send telemetry
 */

import { execSync } from 'node:child_process';
import { parseGitDiff, getDiffSummary } from './diff.js';
import { loadCoverageMap, intersectDiffWithCoverage } from './coverage.js';
import { requestOptimization, sendTelemetry } from './api.js';
import { detectTestCommand } from './environment.js';

/**
 * Execute the run (optimization) command.
 * 
 * @param {Object} context - CLI context
 */
export async function runCommand(context) {
  const { config, serverUrl, baseBranch, framework, verbose, cwd } = context;
  const totalStartTime = performance.now();

  console.log('\n  🧬 smart-test — Genetic Algorithm Test Optimization\n');
  console.log('  ─────────────────────────────────────────────────\n');

  // Step 1: Parse git diff
  console.log('  [1/5] Analyzing code changes...');
  const diffMatrix = parseGitDiff(baseBranch, cwd, verbose);

  if (diffMatrix.size === 0) {
    console.log('        ℹ️  No code changes detected.\n');
    console.log('  Nothing to optimize. Make some changes and try again.\n');
    return;
  }

  const diffSummary = getDiffSummary(diffMatrix);
  console.log(`        📝 ${diffSummary.filesChanged} files changed, ${diffSummary.linesChanged} lines modified\n`);

  // Step 2: Load coverage map
  console.log('  [2/5] Loading coverage baseline...');
  const coverageMap = loadCoverageMap(cwd, verbose);

  if (!coverageMap) {
    console.error('\n  ❌ No coverage map found.');
    console.error('     Run `smart-test init <API_KEY>` to generate a baseline.\n');
    process.exit(1);
  }

  const totalTestsInMap = Object.keys(coverageMap).length;
  console.log(`        📊 ${totalTestsInMap} tests in coverage map\n`);

  // Step 3: Client-side intersection (the key pre-processing step)
  console.log('  [3/5] Intersecting diff with coverage map...');
  const { intersectingTests, totalCandidates } = intersectDiffWithCoverage(
    diffMatrix, coverageMap, verbose
  );

  const intersectingCount = Object.keys(intersectingTests).length;

  if (intersectingCount === 0) {
    console.log('        ℹ️  No tests cover the modified lines.\n');
    console.log('  ✅ Your changes don\'t affect any existing tests.');
    console.log('     Consider writing new tests for the modified code.\n');
    return;
  }

  // Convert diffMatrix (Map) to plain object for JSON serialization
  const diffMatrixObj = {};
  for (const [file, lines] of diffMatrix) {
    diffMatrixObj[file] = lines;
  }

  console.log(`        🎯 ${intersectingCount}/${totalCandidates} tests intersect with changes`);
  console.log(`        📉 ${((1 - intersectingCount / totalCandidates) * 100).toFixed(1)}% pre-filtered client-side\n`);

  // Step 4: Send to backend GA optimizer
  console.log('  [4/5] Running Genetic Algorithm optimization...');
  console.log('        ⏳ Sending payload to backend...\n');

  let result;
  try {
    result = await requestOptimization(serverUrl, config.apiKey, {
      repoId: config.repoId,
      diffMatrix: diffMatrixObj,
      intersectingTests,
    });
  } catch (error) {
    console.error(`\n  ❌ Backend optimization failed: ${error.message}`);
    console.log('     Falling back to running all intersecting tests...\n');

    // Fallback: run all intersecting tests
    result = {
      selectedTests: Object.keys(intersectingTests),
      metadata: {
        engine: 'local_fallback',
        totalTests: intersectingCount,
        selectedCount: intersectingCount,
        gaGenerations: 0,
        convergenceReason: 'backend_error',
        timeTakenMs: 0,
        evolutionData: [],
      },
    };
  }

  const { selectedTests, metadata } = result;

  console.log('        ═══════════════════════════════════════');
  console.log(`        Engine:       ${metadata.engine || 'genetic_algorithm'}`);
  console.log(`        Generations:  ${metadata.gaGenerations || 0}`);
  console.log(`        Convergence:  ${metadata.convergenceReason || 'unknown'}`);
  console.log(`        GA Time:      ${(metadata.timeTakenMs || 0).toFixed(1)}ms`);
  console.log(`        Selected:     ${selectedTests.length}/${totalCandidates} tests`);
  console.log(`        Reduction:    ${((1 - selectedTests.length / totalCandidates) * 100).toFixed(1)}%`);
  console.log('        ═══════════════════════════════════════\n');

  // Step 5: Execute optimized test subset
  console.log('  [5/5] Executing optimized test suite...\n');

  const testCommand = buildTestCommand(framework, selectedTests, context.testCommandOverride, cwd);
  console.log(`        Command: ${testCommand}\n`);

  const testStartTime = performance.now();
  let exitCode = 0;

  try {
    execSync(testCommand, {
      cwd,
      stdio: 'inherit',
      timeout: 10 * 60 * 1000, // 10 minute timeout
    });
  } catch (error) {
    exitCode = error.status || 1;
  }

  const testTime = (performance.now() - testStartTime) / 1000;
  const totalTime = (performance.now() - totalStartTime) / 1000;
  const naiveTime = config.avgSuiteTime || totalCandidates * 2; // Estimate 2s per test
  const timeSaved = Math.max(0, naiveTime - testTime);

  // Results summary
  console.log('\n  ═══════════════════════════════════════════════');
  console.log('  📊 Optimization Results');
  console.log('  ═══════════════════════════════════════════════');
  console.log(`    Status:           ${exitCode === 0 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`    Tests Executed:   ${selectedTests.length} of ${totalCandidates} (${((selectedTests.length / totalCandidates) * 100).toFixed(1)}%)`);
  console.log(`    Execution Time:   ${testTime.toFixed(1)}s`);
  console.log(`    Estimated Naive:  ${naiveTime.toFixed(1)}s`);
  console.log(`    Time Saved:       ${timeSaved.toFixed(1)}s (${((timeSaved / Math.max(naiveTime, 1)) * 100).toFixed(1)}%)`);
  console.log(`    Total Pipeline:   ${totalTime.toFixed(1)}s`);
  console.log('  ═══════════════════════════════════════════════\n');

  // Send telemetry (awaiting it before exit)
  await sendTelemetry(serverUrl, config.apiKey, {
    repoId: config.repoId,
    naiveTimeSec: Math.round(naiveTime),
    gaTimeSec: parseFloat(testTime.toFixed(1)),
    testsSelected: selectedTests.length,
    totalTests: totalCandidates,
    exitCode,
    gaGenerations: metadata.gaGenerations || 0,
    gaBestFitness: metadata.gaBestFitness || 0,
    evolutionData: metadata.evolutionData || [],
    selectedTests,
    diffSummary,
    coverageRatio: metadata.coverageRatio || 1.0,
  });

  process.exit(exitCode);
}

/**
 * Build the targeted test execution command.
 */
function buildTestCommand(framework, selectedTests, overrideCmd, cwd = process.cwd()) {
  const testFiles = selectedTests.join(' ');
  
  let baseCmd = overrideCmd;
  if (!baseCmd) {
    baseCmd = detectTestCommand(cwd) || '';
  }

  if (baseCmd) {
    // e.g. if override is "npm run test:unit", it becomes "npm run test:unit -- file1.test.js"
    // Handle npm/yarn arg passing gracefully
    if (baseCmd.startsWith('npm') && !baseCmd.includes('-- ')) {
      return `${baseCmd} -- ${testFiles}`;
    }
    return `${baseCmd} ${testFiles}`;
  }

  switch (framework) {
    case 'jest':
      return `npx jest ${testFiles} --runInBand --forceExit --passWithNoTests`;
    case 'vitest':
      return `npx vitest run ${testFiles}`;
    case 'mocha':
      return `npx mocha ${testFiles}`;
    case 'pytest':
      return `python -m pytest ${testFiles} -v`;
    default:
      return `npx jest ${testFiles} --runInBand --forceExit --passWithNoTests`;
  }
}
