/**
 * Firebase Admin SDK Initialization
 * 
 * Initializes Firebase Admin with service account credentials
 * for server-side Firestore access and ID token verification.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';

let db;
let auth;

export function initializeFirebase() {
  if (getApps().length > 0) {
    db = getFirestore();
    auth = getAuth();
    return { db, auth };
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialsPath && existsSync(credentialsPath)) {
    // Initialize with service account file
    const serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf-8'));
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized with service account file');
  } else if (process.env.FIREBASE_PROJECT_ID) {
    // Initialize with inline credentials (for deployment)
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized with inline credentials');
  } else {
    // Initialize with Application Default Credentials (GCP environment)
    initializeApp();
    console.log('✅ Firebase Admin initialized with default credentials');
  }

  db = getFirestore();
  auth = getAuth();

  return { db, auth };
}

export function getDb() {
  if (!db) throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  return db;
}

export function getAdminAuth() {
  if (!auth) throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  return auth;
}
