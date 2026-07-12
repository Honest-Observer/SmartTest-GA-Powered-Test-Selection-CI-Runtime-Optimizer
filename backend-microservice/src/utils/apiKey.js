/**
 * API Key Generation Utility
 * 
 * Generates secure random API keys and their bcrypt hashes
 * for CLI authentication.
 */

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const API_KEY_PREFIX = 'tia_';
const API_KEY_LENGTH = 32; // bytes -> 64 hex chars
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Generate a new API key with prefix.
 * @returns {string} The plaintext API key (e.g., "tia_a3f8c2d1...")
 */
export function generateApiKey() {
  const randomPart = randomBytes(API_KEY_LENGTH).toString('hex');
  return `${API_KEY_PREFIX}${randomPart}`;
}

/**
 * Hash an API key using bcrypt.
 * @param {string} apiKey - The plaintext API key
 * @returns {Promise<string>} The bcrypt hash
 */
export async function hashApiKey(apiKey) {
  return bcrypt.hash(apiKey, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare a plaintext API key against a bcrypt hash.
 * @param {string} apiKey - The plaintext API key
 * @param {string} hash - The bcrypt hash
 * @returns {Promise<boolean>} Whether they match
 */
export async function compareApiKey(apiKey, hash) {
  return bcrypt.compare(apiKey, hash);
}
