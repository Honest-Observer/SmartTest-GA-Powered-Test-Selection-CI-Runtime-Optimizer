/**
 * Genetic Algorithm Optimization Engine
 * 
 * Multi-objective optimizer for Test Impact Analysis.
 * Finds the optimal subset of tests that maximizes coverage
 * of modified code lines while minimizing execution time.
 * 
 * Chromosome: Binary array where 1 = test selected, 0 = omitted
 * Fitness: F(c) = α·Coverage(c) - β·Time(c) - Penalty(c)
 */

/**
 * @typedef {Object} GAConfig
 * @property {number} populationSize - Number of chromosomes per generation (default: 100)
 * @property {number} maxGenerations - Max evolutionary cycles (default: 100)
 * @property {number} mutationRate - Bit-flip probability (default: 0.02)
 * @property {number} timeLimitMs - Hard time ceiling in ms (default: 3000)
 * @property {number} stagnationLimit - Gens without improvement before halt (default: 15)
 * @property {number} elitismRate - Top % carried over unchanged (default: 0.05)
 * @property {number} tournamentSize - Tournament selection pool size (default: 5)
 * @property {number} alpha - Coverage weight (default: 0.7)
 * @property {number} beta - Time weight (default: 0.3)
 * @property {number} coveragePenalty - Penalty for incomplete coverage (default: -1000)
 */

const DEFAULT_CONFIG = {
  populationSize: 100,
  maxGenerations: 100,
  mutationRate: 0.02,
  timeLimitMs: 3000,
  stagnationLimit: 15,
  elitismRate: 0.05,
  tournamentSize: 5,
  alpha: 0.7,
  beta: 0.3,
  coveragePenalty: -1000,
};

/**
 * Main GA optimization function.
 * 
 * @param {Object} payload
 * @param {string[]} payload.testIds - Array of test identifiers
 * @param {Object} payload.coverageMatrix - Map of testId -> array of covered file:line strings
 * @param {string[]} payload.modifiedLines - Array of file:line strings that were modified
 * @param {Object} payload.testTimes - Map of testId -> estimated execution time in seconds
 * @param {GAConfig} [config] - Optional configuration overrides
 * @returns {Object} Result with selected tests, evolution data, and metadata
 */
export function optimize(payload, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { testIds, coverageMatrix, modifiedLines, testTimes } = payload;
  const numTests = testIds.length;

  // Edge case: no tests or no modified lines
  if (numTests === 0 || modifiedLines.length === 0) {
    return {
      selectedTests: [],
      generations: 0,
      bestFitness: 0,
      evolutionData: [],
      convergenceReason: 'no_tests_or_changes',
      timeTakenMs: 0,
    };
  }

  // Edge case: only 1 test — just return it
  if (numTests === 1) {
    return {
      selectedTests: [testIds[0]],
      generations: 0,
      bestFitness: 1.0,
      evolutionData: [{ generation: 0, bestFitness: 1.0, avgFitness: 1.0 }],
      convergenceReason: 'single_test',
      timeTakenMs: 0,
    };
  }

  // Pre-compute coverage lookup: for each modified line, which test indices cover it
  const modifiedLineSet = new Set(modifiedLines);
  const testCoverageIndices = new Array(numTests);
  for (let i = 0; i < numTests; i++) {
    const covered = coverageMatrix[testIds[i]] || [];
    testCoverageIndices[i] = new Set(covered.filter(line => modifiedLineSet.has(line)));
  }

  // Normalize test times for the fitness function
  const times = new Float64Array(numTests);
  let maxTime = 0;
  for (let i = 0; i < numTests; i++) {
    times[i] = testTimes[testIds[i]] || 1.0;
    if (times[i] > maxTime) maxTime = times[i];
  }
  // Normalize to [0, 1]
  const totalPossibleTime = times.reduce((a, b) => a + b, 0);

  /**
   * Calculate fitness for a chromosome
   */
  function fitness(chromosome) {
    // Calculate coverage: what % of modified lines are covered?
    const coveredLines = new Set();
    let selectedTime = 0;
    let selectedCount = 0;

    for (let i = 0; i < numTests; i++) {
      if (chromosome[i] === 1) {
        selectedCount++;
        selectedTime += times[i];
        for (const line of testCoverageIndices[i]) {
          coveredLines.add(line);
        }
      }
    }

    const coverageRatio = modifiedLines.length > 0
      ? coveredLines.size / modifiedLines.length
      : 1.0;

    const timeRatio = totalPossibleTime > 0
      ? selectedTime / totalPossibleTime
      : 0;

    // Penalty for incomplete coverage
    const penalty = coverageRatio < 1.0 ? cfg.coveragePenalty * (1 - coverageRatio) : 0;

    // Multi-objective fitness: maximize coverage, minimize time
    const score = (cfg.alpha * coverageRatio) - (cfg.beta * timeRatio) + penalty;

    return { score, coverageRatio, timeRatio, selectedCount, selectedTime };
  }

  /**
   * Generate a random chromosome
   */
  function randomChromosome() {
    const chr = new Uint8Array(numTests);
    for (let i = 0; i < numTests; i++) {
      chr[i] = Math.random() < 0.5 ? 1 : 0;
    }
    // Ensure at least one test is selected
    if (chr.every(g => g === 0)) {
      chr[Math.floor(Math.random() * numTests)] = 1;
    }
    return chr;
  }

  /**
   * Generate a greedy-seeded chromosome
   * Selects all tests that cover at least one modified line
   */
  function greedyChromosome() {
    const chr = new Uint8Array(numTests);
    for (let i = 0; i < numTests; i++) {
      if (testCoverageIndices[i].size > 0) {
        chr[i] = 1;
      }
    }
    // If no test covers any modified line, select all
    if (chr.every(g => g === 0)) {
      chr.fill(1);
    }
    return chr;
  }

  /**
   * Tournament selection: pick k random, return the fittest
   */
  function tournamentSelect(population, fitnesses) {
    let bestIdx = Math.floor(Math.random() * population.length);
    let bestScore = fitnesses[bestIdx].score;

    for (let i = 1; i < cfg.tournamentSize; i++) {
      const idx = Math.floor(Math.random() * population.length);
      if (fitnesses[idx].score > bestScore) {
        bestIdx = idx;
        bestScore = fitnesses[idx].score;
      }
    }
    return population[bestIdx];
  }

  /**
   * Multi-point crossover (2-point)
   */
  function crossover(parent1, parent2) {
    const child1 = new Uint8Array(numTests);
    const child2 = new Uint8Array(numTests);

    let point1 = Math.floor(Math.random() * numTests);
    let point2 = Math.floor(Math.random() * numTests);
    if (point1 > point2) [point1, point2] = [point2, point1];

    for (let i = 0; i < numTests; i++) {
      if (i >= point1 && i <= point2) {
        child1[i] = parent2[i];
        child2[i] = parent1[i];
      } else {
        child1[i] = parent1[i];
        child2[i] = parent2[i];
      }
    }

    return [child1, child2];
  }

  /**
   * Bit-flip mutation
   */
  function mutate(chromosome) {
    for (let i = 0; i < numTests; i++) {
      if (Math.random() < cfg.mutationRate) {
        chromosome[i] = chromosome[i] === 1 ? 0 : 1;
      }
    }
    // Ensure at least one test remains selected
    if (chromosome.every(g => g === 0)) {
      chromosome[Math.floor(Math.random() * numTests)] = 1;
    }
    return chromosome;
  }

  // ==================== MAIN GA LOOP ====================
  const startTime = performance.now();
  const evolutionData = [];
  let convergenceReason = 'max_generations';

  // Initialize population: 99 random + 1 greedy-seeded
  let population = [];
  population.push(greedyChromosome());
  for (let i = 1; i < cfg.populationSize; i++) {
    population.push(randomChromosome());
  }

  let bestEverChromosome = null;
  let bestEverFitness = -Infinity;
  let stagnationCounter = 0;

  for (let gen = 0; gen < cfg.maxGenerations; gen++) {
    // Check time limit
    if (performance.now() - startTime >= cfg.timeLimitMs) {
      convergenceReason = 'time_limit';
      break;
    }

    // Evaluate fitness for entire population
    const fitnesses = population.map(chr => fitness(chr));

    // Track best and average
    let genBestIdx = 0;
    let genBestScore = fitnesses[0].score;
    let totalScore = fitnesses[0].score;

    for (let i = 1; i < fitnesses.length; i++) {
      totalScore += fitnesses[i].score;
      if (fitnesses[i].score > genBestScore) {
        genBestScore = fitnesses[i].score;
        genBestIdx = i;
      }
    }

    const avgScore = totalScore / fitnesses.length;

    evolutionData.push({
      generation: gen,
      bestFitness: parseFloat(genBestScore.toFixed(6)),
      avgFitness: parseFloat(avgScore.toFixed(6)),
      bestChromosome: Array.from(population[genBestIdx]),
    });

    // Update best-ever
    if (genBestScore > bestEverFitness) {
      bestEverFitness = genBestScore;
      bestEverChromosome = new Uint8Array(population[genBestIdx]);
      stagnationCounter = 0;
    } else {
      stagnationCounter++;
    }

    // Check stagnation
    if (stagnationCounter >= cfg.stagnationLimit) {
      convergenceReason = 'stagnation';
      break;
    }

    // === Build next generation ===
    const nextPopulation = [];

    // Elitism: carry top N% directly
    const eliteCount = Math.max(1, Math.floor(cfg.populationSize * cfg.elitismRate));
    const sortedIndices = fitnesses
      .map((f, i) => ({ score: f.score, idx: i }))
      .sort((a, b) => b.score - a.score)
      .slice(0, eliteCount)
      .map(e => e.idx);

    for (const idx of sortedIndices) {
      nextPopulation.push(new Uint8Array(population[idx]));
    }

    // Fill remaining with offspring
    while (nextPopulation.length < cfg.populationSize) {
      const parent1 = tournamentSelect(population, fitnesses);
      const parent2 = tournamentSelect(population, fitnesses);
      let [child1, child2] = crossover(parent1, parent2);
      child1 = mutate(child1);
      child2 = mutate(child2);
      nextPopulation.push(child1);
      if (nextPopulation.length < cfg.populationSize) {
        nextPopulation.push(child2);
      }
    }

    population = nextPopulation;
  }

  // Final evaluation if we broke out early
  if (!bestEverChromosome) {
    const fitnesses = population.map(chr => fitness(chr));
    let bestIdx = 0;
    for (let i = 1; i < fitnesses.length; i++) {
      if (fitnesses[i].score > fitnesses[bestIdx].score) bestIdx = i;
    }
    bestEverChromosome = population[bestIdx];
    bestEverFitness = fitnesses[bestIdx].score;
  }

  // Decode best chromosome to test IDs
  const selectedTests = [];
  for (let i = 0; i < numTests; i++) {
    if (bestEverChromosome[i] === 1) {
      selectedTests.push(testIds[i]);
    }
  }

  // Final fitness details
  const finalFitness = fitness(bestEverChromosome);
  const timeTakenMs = performance.now() - startTime;

  return {
    selectedTests,
    generations: evolutionData.length,
    bestFitness: bestEverFitness,
    coverageRatio: finalFitness.coverageRatio,
    timeRatio: finalFitness.timeRatio,
    selectedCount: finalFitness.selectedCount,
    estimatedTime: finalFitness.selectedTime,
    evolutionData,
    convergenceReason,
    timeTakenMs: parseFloat(timeTakenMs.toFixed(2)),
  };
}
