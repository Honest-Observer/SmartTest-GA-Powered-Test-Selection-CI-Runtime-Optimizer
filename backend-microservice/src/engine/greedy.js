/**
 * Greedy Fallback Algorithm
 * 
 * Deterministic algorithm that runs in parallel with the GA.
 * Selects tests greedily by coverage contribution per unit time.
 * Used as fallback if GA doesn't converge within time limit.
 */

/**
 * @param {Object} payload
 * @param {string[]} payload.testIds
 * @param {Object} payload.coverageMatrix - Map of testId -> covered file:line strings
 * @param {string[]} payload.modifiedLines - Modified file:line strings
 * @param {Object} payload.testTimes - Map of testId -> execution time in seconds
 * @returns {Object} Result with selected tests
 */
export function greedyOptimize(payload) {
  const { testIds, coverageMatrix, modifiedLines, testTimes } = payload;
  const startTime = performance.now();

  if (testIds.length === 0 || modifiedLines.length === 0) {
    return {
      selectedTests: [],
      coverageRatio: 1.0,
      estimatedTime: 0,
      timeTakenMs: 0,
    };
  }

  const modifiedLineSet = new Set(modifiedLines);
  const uncoveredLines = new Set(modifiedLines);
  const selectedTests = [];
  const availableTests = new Set(testIds);
  let totalSelectedTime = 0;

  // Pre-compute which modified lines each test covers
  const testCoverage = new Map();
  for (const testId of testIds) {
    const covered = (coverageMatrix[testId] || []).filter(line => modifiedLineSet.has(line));
    testCoverage.set(testId, new Set(covered));
  }

  // Greedy: iteratively pick the test with best coverage/time ratio
  while (uncoveredLines.size > 0 && availableTests.size > 0) {
    let bestTest = null;
    let bestScore = -Infinity;
    let bestNewCoverage = 0;

    for (const testId of availableTests) {
      const coverage = testCoverage.get(testId);
      // Count how many currently-uncovered lines this test would cover
      let newCoverage = 0;
      for (const line of coverage) {
        if (uncoveredLines.has(line)) newCoverage++;
      }

      if (newCoverage === 0) continue;

      const time = testTimes[testId] || 1.0;
      // Score: new lines covered per second of execution time
      const score = newCoverage / time;

      if (score > bestScore) {
        bestScore = score;
        bestTest = testId;
        bestNewCoverage = newCoverage;
      }
    }

    if (bestTest === null) break; // No remaining test covers any uncovered line

    selectedTests.push(bestTest);
    totalSelectedTime += testTimes[bestTest] || 1.0;
    availableTests.delete(bestTest);

    // Remove newly covered lines from uncovered set
    for (const line of testCoverage.get(bestTest)) {
      uncoveredLines.delete(line);
    }
  }

  const coverageRatio = modifiedLines.length > 0
    ? (modifiedLines.length - uncoveredLines.size) / modifiedLines.length
    : 1.0;

  return {
    selectedTests,
    coverageRatio,
    estimatedTime: totalSelectedTime,
    timeTakenMs: parseFloat((performance.now() - startTime).toFixed(2)),
  };
}
