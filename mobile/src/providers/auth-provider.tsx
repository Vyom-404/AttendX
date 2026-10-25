import React, { createContext, useContext, useMemo, useState } from 'react';

import { apiRequest, ApiUser } from '@/lib/api';

type AuthContextValue = {
  token: string | null;
  user: ApiUser | null;
  signingIn: boolean;
  signIn: (studentId: string, secret: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  async function signIn(studentId: string, secret: string) {
    setSigningIn(true);
    try {
      const result = await apiRequest<{ accessToken: string; user: ApiUser }>('/auth/dev-session', undefined, {
        method: 'POST',
        body: JSON.stringify({ studentId, secret }),
      });
      setToken(result.accessToken);
      setUser(result.user);
    } finally {
      setSigningIn(false);
    }
  }

  function signOut() {
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({ token, user, signingIn, signIn, signOut }), [token, user, signingIn]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
