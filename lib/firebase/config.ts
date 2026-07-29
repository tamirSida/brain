/**
 * Firebase web configuration.
 *
 * Public by design — it identifies the project, it does not authorise anything.
 * Access is governed by Firebase Auth and Firestore security rules, not by
 * keeping this secret. Shared by the server-side store and the client-side
 * auth so the two can never drift onto different projects.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBB4Ikbm82dCC7iSNlzfoDd13M3Z768mTY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "ofek-brain.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "ofek-brain",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "ofek-brain.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID ?? "270481503406",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:270481503406:web:5ad98a036f0e0f90ca693f",
};

/** The audience and issuer suffix every Firebase ID token must carry. */
export const PROJECT_ID = firebaseConfig.projectId;
