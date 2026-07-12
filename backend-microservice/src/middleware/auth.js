/**
 * Authentication Middleware
 * 
 * Two authentication strategies:
 * 1. Bearer Token (Firebase ID token) — for frontend dashboard requests
 * 2. API Key (X-API-Key header) — for CLI tool requests
 */

import { getAdminAuth, getDb } from '../services/firebase.js';
import bcrypt from 'bcryptjs';

/**
 * Verify Firebase ID token from Authorization header.
 * Used by frontend dashboard requests.
 */
export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
    };
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({
      error: 'Invalid token',
      message: 'The provided Firebase ID token is expired or invalid.',
    });
  }
}

/**
 * Verify API key from X-API-Key header.
 * Used by CLI tool requests.
 * 
 * Looks up the hashed API key in Firestore apiKeys collection.
 */
export async function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Missing X-API-Key header. Run `smart-test init <API_KEY>` to configure.',
    });
  }

  try {
    const db = getDb();

    // Look up API key by querying apiKeys collection
    // We store keys with their bcrypt hash as the document ID isn't practical,
    // so we query by a truncated prefix for efficiency, then bcrypt.compare the full key
    const apiKeysRef = db.collection('apiKeys');
    const snapshot = await apiKeysRef
      .where('active', '==', true)
      .get();

    let matchedUserId = null;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const isMatch = await bcrypt.compare(apiKey, data.keyHash);
      if (isMatch) {
        matchedUserId = data.userId;
        break;
      }
    }

    if (!matchedUserId) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or has been revoked.',
      });
    }

    req.user = { uid: matchedUserId };
    next();
  } catch (error) {
    console.error('API key verification failed:', error.message);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal error during API key verification.',
    });
  }
}

/**
 * Flexible auth: accepts either Bearer token OR API key.
 * Tries Bearer first, falls back to API key.
 */
export async function flexibleAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  if (authHeader?.startsWith('Bearer ')) {
    return verifyToken(req, res, next);
  }

  if (apiKey) {
    return verifyApiKey(req, res, next);
  }

  return res.status(401).json({
    error: 'Authentication required',
    message: 'Provide either Authorization: Bearer <token> or X-API-Key header.',
  });
}
