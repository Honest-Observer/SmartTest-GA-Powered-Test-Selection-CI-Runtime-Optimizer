/**
 * Init Command — Cold Start Initialization
 * 
 * 1. Validates API key with backend
 * 2. Detects test framework
 * 3. Runs full test suite with coverage
 * 4. Generates baseline coverage map
 * 5. Uploads to backend
 * 6. Saves local configuration
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { checkHealth, uploadBaseline } from './api.js';
import { generateCoverageMap, loadCoverageMap } from './coverage.js';
import { detectTestCommand } from './environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Execute the init (Cold Start) command.
 * 
 * @param {string} apiKey - API key from the dashboard
 * @param {Object} context - CLI context (config, serverUrl, framework, cwd, etc.)
 */
export async function initCommand(apiKey, context) {
  const { serverUrl, framework, cwd, verbose, saveConfig } = context;

  console.log('  🔧 Initializing smart-test...\n');

  // Step 1: Verify API key and backend connectivity
  console.log('  [1/5] Checking backend connection...');
  const health = await checkHealth(serverUrl);
  if (!health) {
    console.error(`\n  ❌ Cannot reach backend at ${serverUrl}`);
    console.error('     Make sure the backend server is running.\n');
    console.error('     Start it with: cd backend-microservice && npm run dev\n');
    process.exit(1);
  }
  console.log(`        ✅ Backend v${health.version} is online\n`);

  // Step 2: Detect repository info
  console.log('  [2/5] Detecting repository...');
  let repoName;
  try {
    repoName = basename(cwd);
    const remoteUrl = execSync('git remote get-url origin', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'], // Silence Git error prints
    }).trim();
    repoName = remoteUrl.split('/').pop().replace('.git', '') || repoName;
  } catch {
    repoName = basename(cwd);
  }
  console.log(`        Repository: ${repoName}`);
  console.log(`        Framework:  ${framework}`);
  console.log(`        Directory:  ${cwd}\n`);

  // Step 3: Run full test suite with coverage (Cold Start)
  console.log('  [3/5] Running full test suite with coverage...');
  console.log('        ⏳ This may take several minutes on first run...\n');

  const reporterPath = join(__dirname, 'reporter.cjs').replace(/\\/g, '/');
  const coverageCommand = getCoverageCommand(framework, reporterPath, context.testCommandOverride, cwd);
  console.log(`        Command: ${coverageCommand}\n`);

  const suiteStartTime = performance.now();

  try {
    execSync(coverageCommand, {
      cwd,
      stdio: verbose ? 'inherit' : 'pipe',
      timeout: 30 * 60 * 1000, // 30 minute timeout
      env: { ...process.env, FORCE_COLOR: '0' },
    });
  } catch (error) {
    // Tests may fail but still generate coverage
    if (verbose) {
      console.warn('        ⚠️  Some tests may have failed (coverage still collected)');
    }
  }

  const suiteTime = (performance.now() - suiteStartTime) / 1000;
  console.log(`        ✅ Test suite completed in ${suiteTime.toFixed(1)}s\n`);

  // Step 4: Parse coverage and build coverage map
  console.log('  [4/5] Building coverage map...');
  let coverageMap;

  try {
    const rawCoveragePath = join(cwd, '.smart-test', 'coverage-map-raw.json');
    if (existsSync(rawCoveragePath)) {
      coverageMap = JSON.parse(readFileSync(rawCoveragePath, 'utf-8'));
    } else {
      coverageMap = loadCoverageMap(cwd, verbose);
      if (!coverageMap) {
        coverageMap = generateCoverageMap(framework, cwd, verbose);
      }
    }
  } catch (error) {
    console.error(`\n  ❌ Failed to parse coverage: ${error.message}`);
    console.error('     Make sure your test framework generates coverage output.\n');

    // Create a minimal coverage map as fallback
    console.log('        Creating minimal baseline from test file detection...');
    coverageMap = buildFallbackCoverageMap(cwd, framework);
  }

  const totalTests = Object.keys(coverageMap).length;
  
  if (totalTests === 0) {
    console.error('\n  ❌ Error: No tests were found in the coverage map.');
    console.error('     The test suite either ran 0 tests, or coverage was not generated.');
    console.error('     Try specifying your exact test command using the --cmd flag.');
    console.error('     Example: smart-test init <API_KEY> --cmd "npm run test"');
    process.exit(1);
  }

  const coverageString = JSON.stringify(coverageMap);
  const baselineHash = createHash('md5').update(coverageString).digest('hex');

  console.log(`        Total test entries: ${totalTests}`);
  console.log(`        Baseline hash: ${baselineHash.substring(0, 12)}...\n`);

  // Step 5: Upload baseline to backend
  console.log('  [5/5] Uploading baseline to server...');

  try {
    const result = await uploadBaseline(serverUrl, apiKey, {
      repoName,
      coverageMap,
      totalTests,
      avgSuiteTime: Math.round(suiteTime),
    });

    // Save configuration locally
    const config = {
      apiKey,
      serverUrl,
      repoId: result.repoId,
      repoName,
      framework: framework,
      baselineHash: result.baselineHash || baselineHash,
      totalTests,
      avgSuiteTime: Math.round(suiteTime),
      initializedAt: new Date().toISOString(),
    };

    saveConfig(config);

    // Also save coverage map locally for future intersections
    const localCacheDir = join(cwd, '.smart-test');
    if (!existsSync(localCacheDir)) {
      mkdirSync(localCacheDir, { recursive: true });
    }
    writeFileSync(
      join(localCacheDir, 'coverage-map.json'),
      JSON.stringify({ _format: 'smart-test-tia', coverageMap }, null, 2)
    );

    // Add .smart-test to .gitignore if it exists
    const gitignorePath = join(cwd, '.gitignore');
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf-8');
      if (!gitignore.includes('.smart-test')) {
        writeFileSync(gitignorePath, gitignore + '\n# TIA Optimizer\n.smart-test/\n');
      }
    }

    console.log(`        ✅ Baseline uploaded successfully!`);
    console.log(`        Repository ID: ${result.repoId}\n`);

    console.log('  ══════════════════════════════════════════════');
    console.log('  ✅ Initialization complete!\n');
    console.log('  You can now run optimized tests with:\n');
    console.log('    $ smart-test run\n');
    console.log('  This will analyze your changes and run only');
    console.log('  the tests that cover modified code lines.');
    console.log('  ══════════════════════════════════════════════\n');
  } catch (error) {
    console.error(`\n  ❌ Failed to upload baseline: ${error.message}\n`);
    process.exit(1);
  }
}

/**
 * Get the test coverage command for the detected framework.
 */
function getCoverageCommand(framework, reporterPath, overrideCmd, cwd = process.cwd()) {
  let baseCmd = overrideCmd;

  if (!baseCmd) {
    baseCmd = detectTestCommand(cwd) || '';
  }

  if (baseCmd) {
    if (baseCmd.startsWith('npm') && !baseCmd.includes('-- ')) {
      baseCmd = `${baseCmd} -- --coverage`;
    } else {
      baseCmd = `${baseCmd} --coverage`;
    }
  }

  // Inject reporter arguments so we get per-test coverage mappings
  const clearCovPath = join(__dirname, 'clear-coverage.cjs').replace(/\\/g, '/');
  switch (framework) {
    case 'jest': {
      const reporterArgs = `--reporters=default --reporters="${reporterPath}" --setupFilesAfterEnv="${clearCovPath}" --forceExit --passWithNoTests`;
      return baseCmd ? `${baseCmd} ${reporterArgs}` : `npx jest --coverage ${reporterArgs}`;
    }
    case 'vitest':
      return baseCmd ? `${baseCmd} --reporter=json` : 'npx vitest run --coverage --reporter=json';
    case 'mocha':
      return baseCmd ? `${baseCmd}` : 'npx nyc --reporter=json mocha';
    case 'pytest':
      return baseCmd ? `${baseCmd}` : 'python -m pytest --cov --cov-report=json';
    default: {
      const reporterArgs = `--reporters=default --reporters="${reporterPath}" --forceExit --passWithNoTests`;
      return baseCmd ? `${baseCmd} ${reporterArgs}` : `npx jest --coverage ${reporterArgs}`;
    }
  }
}

/**
 * Build a fallback coverage map when actual coverage data isn't available.
 * Uses test file detection and heuristic file matching.
 */
function buildFallbackCoverageMap(cwd, framework) {
  const coverageMap = {};

  // Find test files
  try {
    const testPattern = framework === 'pytest' ? '**/*test*.py' : '**/*.test.{js,ts,jsx,tsx}';
    const findCommand = process.platform === 'win32'
      ? `dir /s /b "${cwd}" | findstr /i "test" | findstr /v /i "node_modules"`
      : `find "${cwd}" -name "*.test.*" -not -path "*/node_modules/*"`;

    const output = execSync(findCommand, {
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      encoding: 'utf-8',
      cwd,
      timeout: 10000,
    }).trim();

    if (output) {
      const testFiles = output.split('\n').filter(Boolean).slice(0, 100);
      for (const testFile of testFiles) {
        const relative = testFile.replace(cwd, '').replace(/^[\/\\]/, '');
        const sourceName = relative.replace(/\.test\.(js|ts|jsx|tsx)$/, '.$1');

        coverageMap[basename(relative)] = {
          coveredFiles: { [sourceName]: Array.from({ length: 50 }, (_, i) => i + 1) },
          estimatedTime: 1.0 + Math.random() * 4,
        };
      }
    }
  } catch { /* ignore */ }

  return coverageMap;
}
