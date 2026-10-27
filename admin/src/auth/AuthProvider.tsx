import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { ApiUser } from '../api/types';

type AuthStatus = 'checking' | 'signed-out' | 'signed-in';
type AuthContextValue = {
  status: AuthStatus;
  token: string | null;
  user: ApiUser | null;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function getFirebaseAuth() {
  if (Object.values(firebaseConfig).some((value) => !value)) {
    throw new Error('Firebase Web config is missing. Copy admin/.env.example to admin/.env and fill in the Firebase Web app values.');
  }
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

const firebaseAuth = getFirebaseAuth();

async function exchangeFirebaseUser(firebaseUser: FirebaseUser) {
  const idToken = await firebaseUser.getIdToken();
  const response = await fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')}/auth/firebase-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || 'AttendX could not verify this Google account.');
  if (!result.user?.roles?.includes('admin')) {
    await firebaseSignOut(firebaseAuth);
    throw new Error('Admin access is required for the web portal.');
  }
  return result as { accessToken: string; user: ApiUser };
}
