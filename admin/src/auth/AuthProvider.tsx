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
