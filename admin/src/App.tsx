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

  const loadReport = useCallback(async (sessionId: string) => {
    if (!token || !sessionId) {
      setRoster([]);
      setAttempts([]);
      return;
    }
    try {
      const [attendance, attemptResult] = await Promise.all([
        apiRequest<{ records: RosterRecord[] }>(`/admin/sessions/${sessionId}/attendance`, token),
        apiRequest<{ attempts: Attempt[] }>(`/admin/sessions/${sessionId}/attempts`, token),
      ]);
      setRoster(attendance.records || []);
      setAttempts(attemptResult.attempts || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this session report.');
    }
  }, [token]);

  useEffect(() => { void loadReport(selectedId); }, [selectedId, loadReport]);

  const selected = sessions.find((session) => session._id === selectedId);
  const presentCount = roster.filter((record) => record.status === 'present').length;
  const absentCount = roster.filter((record) => record.status === 'absent').length;
  const filteredRoster = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roster;
    return roster.filter((record) =>
      `${record.name} ${record.studentId} ${record.roomNumber || ''}`.toLowerCase().includes(query),
    );
  }, [roster, search]);

  async function createSession() {
    const minutes = Number(duration);
    if (!title.trim() || !Number.isFinite(minutes) || minutes < 5 || minutes > 720) {
      setError('Choose a title and a duration between 5 minutes and 12 hours.');
      return;
    }
    if (!token) return;
    setBusy(true);
    setError('');
    setNotice('');
    const startAt = new Date();
    try {
      const result = await apiRequest<{ session: AdminSession }>('/admin/sessions', token, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          startAt: startAt.toISOString(),
          endAt: new Date(startAt.getTime() + minutes * 60_000).toISOString(),
        }),
      });
      setSessions((current) => [result.session, ...current]);
      setSelectedId(result.session._id);
      setShowCreate(false);
      setNotice('Attendance session opened.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the session.');
    } finally {
      setBusy(false);
    }
  }
