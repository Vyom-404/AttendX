import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { apiRequest, ApiUser } from '@/lib/api';
import { getFirebaseIdToken, signInWithGoogle, signOutFirebase } from '@/lib/google-auth';

type AuthContextValue = {
  token: string | null;
  user: ApiUser | null;
  authReady: boolean;
  signingIn: boolean;
  signInDev: (studentId: string, secret: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const exchangeFirebaseToken = useCallback(async (idToken: string) => {
    const result = await apiRequest<{ accessToken: string; user: ApiUser }>('/auth/firebase-session', undefined, {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    if (Platform.OS === 'web' && !result.user.roles.includes('admin')) {
      setToken(null);
      setUser(null);
      await signOutFirebase();
      throw new Error('Student accounts can sign in only from the phone app.');
    }
    setToken(result.accessToken);
    setUser(result.user);
  }, []);

  useEffect(() => {
    let mounted = true;

    void getFirebaseIdToken()
      .then(async (idToken) => {
        if (idToken) await exchangeFirebaseToken(idToken);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [exchangeFirebaseToken]);

  async function signInDev(studentId: string, secret: string) {
    setSigningIn(true);
    try {
      const result = await apiRequest<{ accessToken: string; user: ApiUser }>('/auth/dev-session', undefined, {
        method: 'POST',
        body: JSON.stringify({ studentId, secret }),
      });
      if (!result.user.roles.includes('admin')) {
        throw new Error('Student accounts can sign in only from the phone app.');
      }
      setToken(result.accessToken);
      setUser(result.user);
    } finally {
      setSigningIn(false);
    }
  }

  async function signInGoogle() {
    setSigningIn(true);
    try {
      const idToken = await signInWithGoogle();
      await exchangeFirebaseToken(idToken);
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    setToken(null);
    setUser(null);
    await signOutFirebase();
  }

  const value = { token, user, authReady, signingIn, signInDev, signInGoogle, signOut };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
