/**
 * Auth Endpoints
 * API key management for CLI authentication.
 */

import { Router } from 'express';
import { getDb } from '../services/firebase.js';
import { generateApiKey, hashApiKey } from '../utils/apiKey.js';

const router = Router();

// POST /api/v1/auth/api-key - Generate a new API key
router.post('/api-key', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.uid;

    // Deactivate any existing API keys for this user
    const existingKeys = await db.collection('apiKeys')
      .where('userId', '==', userId)
      .where('active', '==', true)
      .get();

    const batch = db.batch();
    for (const doc of existingKeys.docs) {
      batch.update(doc.ref, { active: false, revokedAt: new Date() });
    }

    // Generate new API key
    const plainTextKey = generateApiKey();
    const keyHash = await hashApiKey(plainTextKey);

    // Store the new key
    const keyDocRef = db.collection('apiKeys').doc();
    batch.set(keyDocRef, {
      userId,
      keyHash,
      active: true,
      createdAt: new Date(),
    });

    // Also store the hash on the user document for quick reference
    const userRef = db.collection('users').doc(userId);
    batch.set(userRef, {
      apiKeyHash: keyHash,
      apiKeyPrefix: plainTextKey.substring(0, 12) + '...',
      apiKeyUpdatedAt: new Date(),
    }, { merge: true });

    await batch.commit();

    res.status(201).json({
      apiKey: plainTextKey,
      message: 'API key generated successfully. Store this key securely — it cannot be retrieved again.',
      warning: 'Previous API keys have been revoked.',
    });
  } catch (error) {
    console.error('Generate API key error:', error);
    res.status(500).json({ error: 'Failed to generate API key', message: error.message });
  }
});

// GET /api/v1/auth/api-key - Get API key status
router.get('/api-key', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.uid;

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists || !userDoc.data().apiKeyPrefix) {
      return res.json({
        hasKey: false,
        message: 'No API key generated yet.',
      });
    }

    const data = userDoc.data();
    res.json({
      hasKey: true,
      keyPrefix: data.apiKeyPrefix,
      updatedAt: data.apiKeyUpdatedAt,
    });
  } catch (error) {
    console.error('Get API key status error:', error);
    res.status(500).json({ error: 'Failed to get API key status', message: error.message });
  }
});

// POST /api/v1/auth/register - Register user in Firestore after first login
router.post('/register', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.uid;

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      // User already exists, update last login
      await userRef.update({ lastLoginAt: new Date() });
      return res.json({ message: 'Welcome back', userId });
    }

    // Create new user document
    await userRef.set({
      uid: userId,
      email: req.user.email,
      displayName: req.user.name || '',
      photoURL: req.user.picture || '',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    res.status(201).json({ message: 'User registered', userId });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user', message: error.message });
  }
});

export default router;
