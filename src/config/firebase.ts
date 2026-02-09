import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

let db: Firestore;

if (!getApps().length) {
  // Try to load service account from JSON file first
  let serviceAccount;
  try {
    const serviceAccountPath = join(process.cwd(), 'telebot-52df8-firebase-adminsdk-fbsvc-6e328483fe.json');
    const fileContent = readFileSync(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(fileContent);
  } catch {
    // Fallback to environment variables
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };
  }

  initializeApp({
    credential: cert(serviceAccount),
  });
}

db = getFirestore();

export { db };
