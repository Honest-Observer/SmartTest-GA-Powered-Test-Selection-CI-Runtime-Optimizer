/**
 * Worker Thread Wrapper for the Genetic Algorithm
 * 
 * Runs the GA in an isolated worker thread to avoid blocking
 * the Express main event loop during CPU-intensive optimization.
 * 
 * Receives payload via workerData, posts result via parentPort.
 */

import { parentPort, workerData } from 'node:worker_threads';
import { optimize } from './ga.js';

try {
  const { payload, config } = workerData;
  const result = optimize(payload, config);
  parentPort.postMessage({ success: true, result });
} catch (error) {
  parentPort.postMessage({
    success: false,
    error: error.message,
    stack: error.stack,
  });
}
