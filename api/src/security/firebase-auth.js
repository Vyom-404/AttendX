import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const appName = "attendx-auth";
let firebaseAuth;

export function getFirebaseAuth() {
  if (firebaseAuth) return firebaseAuth;

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    const error = new Error("Firebase Admin credentials are not configured");
    error.code = "FIREBASE_AUTH_NOT_CONFIGURED";
    throw error;
  }

  const app = getApps().find((candidate) => candidate.name === appName)
    || initializeApp(
      {
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      },
      appName,
    );

  firebaseAuth = getAuth(app);
  return firebaseAuth;
}
