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

function SignInPage() {
  const { error, signIn } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signIn();
    } catch {
      // The auth provider keeps a readable error for the sign-in page.
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="signin-layout">
      <section className="signin-card">
        <div className="brand-mark">A</div>
        <p className="eyebrow">WARDEN PORTAL</p>
        <h1>Sign in to Attend<span className="brand-accent">X</span></h1>
        <p className="muted">Use the Google account linked to your AttendX admin account.</p>
        {error && <p className="error-banner" role="alert">{error}</p>}
        <button className="button button-primary button-wide" onClick={handleSignIn} disabled={signingIn}>
          {signingIn ? 'Signing in…' : 'Continue with Google'}
        </button>
      </section>
    </main>
  );
}

function Dashboard() {
  const { token, user, signOut } = useAuth();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [roster, setRoster] = useState<RosterRecord[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('Hostel attendance');
  const [duration, setDuration] = useState('60');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSessions = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const result = await apiRequest<{ sessions: AdminSession[] }>('/admin/sessions', token);
      setSessions(result.sessions || []);
      setSelectedId((current) => current && result.sessions.some((item) => item._id === current)
        ? current
        : result.sessions[0]?._id || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load sessions.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);
