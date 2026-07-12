/**
 * API Client
 * 
 * Handles communication with the TIA Optimizer backend.
 * Uses native fetch (Node 18+) — zero external dependencies.
 */

const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Send optimization request to backend.
 * 
 * @param {string} serverUrl - Backend server URL
 * @param {string} apiKey - API key for authentication
 * @param {Object} payload - { repoId, diffMatrix, intersectingTests }
 * @returns {Object} - { selectedTests, metadata }
 */
export async function requestOptimization(serverUrl, apiKey, payload) {
  const response = await fetchWithTimeout(`${serverUrl}/api/v1/optimize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(payload),
  }, 15000); // 15s timeout for GA computation

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Optimization failed (${response.status}): ${error.message || error.error}`);
  }

  return response.json();
}

/**
 * Upload baseline coverage map to backend.
 * 
 * @param {string} serverUrl
 * @param {string} apiKey
 * @param {Object} payload - { repoId, repoName, coverageMap, totalTests, avgSuiteTime }
 * @returns {Object} - { repoId, baselineHash }
 */
export async function uploadBaseline(serverUrl, apiKey, payload) {
  const response = await fetchWithTimeout(`${serverUrl}/api/v1/baseline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Baseline upload failed (${response.status}): ${error.message || error.error}`);
  }

  return response.json();
}

/**
 * Send post-run telemetry to backend.
 * Non-blocking — errors are logged but don't halt execution.
 * 
 * @param {string} serverUrl
 * @param {string} apiKey
 * @param {Object} telemetry
 */
export async function sendTelemetry(serverUrl, apiKey, telemetry) {
  try {
    const response = await fetchWithTimeout(`${serverUrl}/api/v1/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(telemetry),
    }, 5000); // 5s timeout — telemetry is non-critical

    if (!response.ok) {
      console.warn('  ⚠️  Telemetry submission failed (non-critical)');
    }
  } catch {
    // Silently fail — telemetry should never block the developer
  }
}

/**
 * Check backend health.
 * 
 * @param {string} serverUrl
 * @returns {Object|null}
 */
export async function checkHealth(serverUrl) {
  try {
    const response = await fetchWithTimeout(`${serverUrl}/api/v1/health`, {}, 3000);
    if (response.ok) return response.json();
    return null;
  } catch {
    return null;
  }
}

/**
 * Check baseline status for a repository.
 * 
 * @param {string} serverUrl
 * @param {string} apiKey
 * @param {string} repoId
 * @returns {Object|null}
 */
export async function checkBaseline(serverUrl, apiKey, repoId) {
  try {
    const response = await fetchWithTimeout(`${serverUrl}/api/v1/baseline/${repoId}`, {
      headers: { 'X-API-Key': apiKey },
    }, 5000);

    if (response.ok) return response.json();
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch with timeout using AbortController.
 */
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
