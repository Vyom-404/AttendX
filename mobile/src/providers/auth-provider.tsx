import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { apiRequest, ApiUser } from '@/lib/api';
import { getFirebaseIdToken, signInWithGoogle, signOutFirebase } from '@/lib/google-auth';

type AuthContextValue = {
  token: string | null;
  user: ApiUser | null;
  authReady: boolean;
  signingIn: boolean;
  authError: string;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

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
      .catch((reason) => {
        if (mounted) setAuthError(reason instanceof Error ? reason.message : 'Could not restore your sign-in.');
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [exchangeFirebaseToken]);

  async function signInGoogle() {
    setSigningIn(true);
    setAuthError('');
    try {
      const idToken = await signInWithGoogle();
      await exchangeFirebaseToken(idToken);
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : 'Google sign-in failed. Please try again.');
      throw reason;
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    setToken(null);
    setUser(null);
    try {
      await signOutFirebase();
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : 'Could not sign out. Please try again.');
      throw reason;
    }
  }

  const value = { token, user, authReady, signingIn, authError, signInGoogle, signOut };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
