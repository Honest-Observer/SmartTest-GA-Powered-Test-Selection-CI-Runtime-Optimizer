/**
 * Coverage Map Intersection Engine
 * 
 * Reads the locally stored baseline coverage report and
 * performs an intersection against the Git diff matrix.
 * Isolates only tests that cover modified code lines.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load and parse the local coverage map.
 * Supports Istanbul/NYC JSON format and custom TIA format.
 * 
 * @param {string} cwd - Working directory (repository root)
 * @param {boolean} verbose - Enable verbose logging
 * @returns {Object|null} Parsed coverage map or null if not found
 */
export function loadCoverageMap(cwd, verbose = false) {
  // Try multiple coverage file locations
  const coveragePaths = [
    join(cwd, '.smart-test', 'coverage-map.json'),  // Our custom format
    join(cwd, 'coverage', 'coverage-final.json'),    // Istanbul/NYC
    join(cwd, 'coverage', 'coverage-summary.json'),  // Istanbul summary
    join(cwd, '.nyc_output', 'coverage-final.json'), // NYC output
  ];

  for (const coveragePath of coveragePaths) {
    if (existsSync(coveragePath)) {
      try {
        const raw = readFileSync(coveragePath, 'utf-8');
        const data = JSON.parse(raw);

        if (verbose) console.log(`  📂 Loaded coverage from: ${coveragePath}`);

        // Detect format and normalize
        if (data._format === 'smart-test-tia') {
          // Our custom format — already normalized
          return data.coverageMap;
        }

        // Istanbul/NYC format — needs conversion
        return convertIstanbulCoverage(data, verbose);
      } catch (error) {
        if (verbose) console.log(`  ⚠️  Failed to parse ${coveragePath}: ${error.message}`);
      }
    }
  }

  return null;
}

/**
 * Convert Istanbul/NYC coverage-final.json to our format.
 * 
 * Istanbul format: { "/abs/path/to/file.js": { statementMap: {...}, s: {...}, ... } }
 * Our format: { "testName": { coveredFiles: { "relative/path": [lineNumbers] }, estimatedTime: number } }
 * 
 * @param {Object} istanbulData - Raw Istanbul coverage data
 * @param {boolean} verbose
 * @returns {Object} Normalized coverage map
 */
function convertIstanbulCoverage(istanbulData, verbose = false) {
  const coverageMap = {};

  // Istanbul coverage-final.json maps files to their coverage info
  // We need to invert this: map tests to covered files
  // Since Istanbul doesn't inherently track per-test coverage,
  // we create synthetic test mappings based on file coverage

  for (const [filePath, coverageInfo] of Object.entries(istanbulData)) {
    if (!coverageInfo.statementMap || !coverageInfo.s) continue;

    // Extract covered line numbers from statement coverage
    const coveredLines = [];
    for (const [stmtId, count] of Object.entries(coverageInfo.s)) {
      if (count > 0 && coverageInfo.statementMap[stmtId]) {
        const stmt = coverageInfo.statementMap[stmtId];
        for (let line = stmt.start.line; line <= stmt.end.line; line++) {
          if (!coveredLines.includes(line)) {
            coveredLines.push(line);
          }
        }
      }
    }

    // Normalize path (remove leading slash, make relative)
    let normalizedPath = filePath;
    if (normalizedPath.startsWith('/')) {
      // Try to make it relative to common prefixes
      const parts = normalizedPath.split('/');
      const srcIdx = parts.findIndex(p => p === 'src' || p === 'lib' || p === 'app');
      if (srcIdx >= 0) {
        normalizedPath = parts.slice(srcIdx).join('/');
      }
    }

    // Create a synthetic test entry for this file
    const testName = `test_${normalizedPath.replace(/[\/\\\.]/g, '_')}`;
    coverageMap[testName] = {
      coveredFiles: { [normalizedPath]: coveredLines },
      estimatedTime: 1.0 + Math.random() * 3, // Estimate
    };
  }

  if (verbose) {
    console.log(`  📊 Converted Istanbul coverage: ${Object.keys(coverageMap).length} test entries`);
  }

  return coverageMap;
}

/**
 * Perform intersection of git diff with coverage map.
 * For every modified line, find which tests cover that line.
 * 
 * @param {Map<string, number[]>} diffMatrix - Git diff: filePath -> [lineNumbers]
 * @param {Object} coverageMap - Coverage map: testName -> { coveredFiles: { path: [lines] } }
 * @param {boolean} verbose - Enable verbose logging
 * @returns {Object} Intersection result: { intersectingTests, totalCandidates }
 */
export function intersectDiffWithCoverage(diffMatrix, coverageMap, verbose = false) {
  const intersectingTests = {};
  const modifiedFiles = Array.from(diffMatrix.keys());

  for (const [testName, testInfo] of Object.entries(coverageMap)) {
    const coveredFiles = testInfo.coveredFiles || {};
    let intersects = false;
    const relevantCoverage = {};

    for (const modifiedFile of modifiedFiles) {
      const modifiedLines = diffMatrix.get(modifiedFile);

      // Check all covered files for this test
      for (const [coveredFile, coveredLines] of Object.entries(coveredFiles)) {
        // Fuzzy match file paths (handle different path formats)
        if (pathsMatch(modifiedFile, coveredFile)) {
          // Find intersection of modified lines and covered lines
          const intersection = modifiedLines.filter(line => coveredLines.includes(line));

          if (intersection.length > 0) {
            intersects = true;
            relevantCoverage[modifiedFile] = coveredLines;
          }
        }
      }
    }

    if (intersects) {
      intersectingTests[testName] = {
        coveredFiles: relevantCoverage,
        estimatedTime: testInfo.estimatedTime || 2.0,
      };
    }
  }

  if (verbose) {
    const totalTests = Object.keys(coverageMap).length;
    const selectedTests = Object.keys(intersectingTests).length;
    console.log(`  🎯 Coverage intersection:`);
    console.log(`     Total tests in coverage map: ${totalTests}`);
    console.log(`     Tests intersecting with diff: ${selectedTests}`);
    console.log(`     Tests eliminated: ${totalTests - selectedTests} (${((1 - selectedTests / totalTests) * 100).toFixed(1)}% reduction)`);
  }

  return {
    intersectingTests,
    totalCandidates: Object.keys(coverageMap).length,
  };
}

/**
 * Fuzzy match file paths, handling different path formats.
 * e.g., "src/auth/login.ts" matches "src/auth/login.ts"
 * and "/app/project/src/auth/login.ts" matches "src/auth/login.ts"
 */
function pathsMatch(path1, path2) {
  // Normalize separators
  const norm1 = path1.replace(/\\/g, '/').toLowerCase();
  const norm2 = path2.replace(/\\/g, '/').toLowerCase();

  // Exact match
  if (norm1 === norm2) return true;

  // One path ends with the other
  if (norm1.endsWith(norm2) || norm2.endsWith(norm1)) return true;

  // Match by filename only as last resort
  const file1 = norm1.split('/').pop();
  const file2 = norm2.split('/').pop();
  if (file1 === file2) {
    // Require at least one shared directory component
    const dirs1 = norm1.split('/').slice(0, -1);
    const dirs2 = norm2.split('/').slice(0, -1);
    return dirs1.some(d => dirs2.includes(d));
  }

  return false;
}

/**
 * Generate coverage map from a full test run.
 * Used during Cold Start initialization.
 * 
 * @param {string} framework - Test framework (jest, vitest, mocha, pytest)
 * @param {string} cwd - Working directory
 * @param {boolean} verbose
 * @returns {Object} The generated coverage map
 */
export function generateCoverageMap(framework, cwd, verbose = false) {
  const coveragePath = join(cwd, 'coverage', 'coverage-final.json');

  if (!existsSync(coveragePath)) {
    throw new Error(
      'Coverage file not found. Ensure the test run generated coverage output.\n' +
      'Expected: coverage/coverage-final.json'
    );
  }

  const raw = readFileSync(coveragePath, 'utf-8');
  const istanbulData = JSON.parse(raw);

  return convertIstanbulCoverage(istanbulData, verbose);
}
