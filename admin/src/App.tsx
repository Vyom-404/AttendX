import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiRequest, downloadReport } from './api/client';
import type { AdminSession, Attempt, RosterRecord } from './api/types';
import { useAuth } from './auth/AuthProvider';

function sessionStatus(session: AdminSession) {
  const now = Date.now();
  if (session.status === 'closed' || now >= new Date(session.endAt).getTime()) return 'Closed';
  if (now < new Date(session.startAt).getTime()) return 'Upcoming';
  return 'Open';
}

export function App() {
  const { status } = useAuth();

  if (status === 'checking') {
    return <main className="center-page"><div className="spinner" /><p>Checking your AttendX sign-in…</p></main>;
  }
  if (status === 'signed-out') return <SignInPage />;
  return <Dashboard />;
}
