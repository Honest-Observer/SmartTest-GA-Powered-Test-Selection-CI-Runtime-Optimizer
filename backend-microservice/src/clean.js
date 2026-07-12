/**
 * Cleanup Script — Remove ALL demo/seed data from Firestore
 * 
 * Usage: npm run clean
 * 
 * Deletes documents from: repositories, telemetry, apiKeys, users, gaConfigs
 * that were created by the seed script (demo-user-001).
 * Also offers --all flag to wipe ALL data.
 */

import 'dotenv/config';
import { initializeFirebase, getDb } from './services/firebase.js';

const DEMO_USER_ID = 'demo-user-001';

async function deleteCollection(db, collectionPath, query) {
  const snapshot = await query.get();
  if (snapshot.empty) {
    console.log(`    (empty) ${collectionPath}`);
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`    ✓ Deleted ${snapshot.size} docs from ${collectionPath}`);
  return snapshot.size;
}

async function clean() {
  const isAll = process.argv.includes('--all');

  console.log(`\n🧹 Cleaning Firestore${isAll ? ' (ALL data)' : ' (demo data only)'}...\n`);

  initializeFirebase();
  const db = getDb();

  let totalDeleted = 0;

  if (isAll) {
    // Delete ALL documents from all collections
    const collections = ['repositories', 'telemetry', 'apiKeys', 'users', 'gaConfigs'];
    for (const col of collections) {
      const snapshot = await db.collection(col).limit(500).get();
      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`  ✓ Deleted ${snapshot.size} docs from ${col}`);
        totalDeleted += snapshot.size;
      } else {
        console.log(`  (empty) ${col}`);
      }
    }
  } else {
    // Delete only demo user data
    console.log('  Cleaning demo user data...');

    totalDeleted += await deleteCollection(db, 'repositories',
      db.collection('repositories').where('userId', '==', DEMO_USER_ID));

    totalDeleted += await deleteCollection(db, 'telemetry',
      db.collection('telemetry').where('userId', '==', DEMO_USER_ID));

    totalDeleted += await deleteCollection(db, 'apiKeys',
      db.collection('apiKeys').where('userId', '==', DEMO_USER_ID));

    // Delete demo user document
    const userDoc = await db.collection('users').doc(DEMO_USER_ID).get();
    if (userDoc.exists) {
      await db.collection('users').doc(DEMO_USER_ID).delete();
      console.log('    ✓ Deleted demo user');
      totalDeleted++;
    }
  }

  console.log(`\n✅ Cleanup complete. ${totalDeleted} documents removed.\n`);
  process.exit(0);
}

clean().catch(err => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
