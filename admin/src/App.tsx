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

  async function closeSession() {
    if (!selected || !token) return;
    setError('');
    try {
      const result = await apiRequest<{ session: AdminSession }>(`/admin/sessions/${selected._id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed' }),
      });
      setSessions((current) => current.map((item) => item._id === result.session._id ? result.session : item));
      setNotice('Session closed.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not close the session.');
    }
  }

  async function exportReport() {
    if (!selected || !token) return;
    setError('');
    try {
      const csv = await downloadReport(`/admin/sessions/${selected._id}/export`, token);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `attendx-${selected.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice('Report downloaded.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export this report.');
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="AttendX admin home"><span className="brand-mark small">A</span><span>Attend<span className="brand-accent">X</span></span></a>
        <div className="account-actions"><span className="admin-badge">Admin access</span><span className="account-name">{user?.name}</span><button className="button button-quiet" onClick={() => void signOut()}>Sign out</button></div>
      </header>

      <section className="page-heading">
        <div><p className="eyebrow">ATTENDANCE OVERVIEW</p><h1>Good day, {user?.name?.split(' ')[0] || 'Admin'}</h1><p className="muted">Manage sessions and review hostel attendance.</p></div>
        <button className="button button-primary" onClick={() => { setShowCreate((value) => !value); setError(''); }}>{showCreate ? 'Cancel' : '+ New session'}</button>
      </section>

      {error && <p className="error-banner" role="alert">{error}</p>}
      {notice && <button className="notice-banner" onClick={() => setNotice('')}>{notice} ×</button>}

      {showCreate && <section className="panel create-panel">
        <div><h2>Open an attendance session</h2><p className="muted">It starts now and closes after the selected duration.</p></div>
        <label>Session title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Evening roll call" /></label>
        <label>Duration in minutes<input type="number" min="5" max="720" value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
        <button className="button button-primary" onClick={() => void createSession()} disabled={busy}>{busy ? 'Opening…' : 'Open session'}</button>
      </section>}

      <section className="metrics-grid" aria-label="Attendance totals">
        <MetricCard label="Students" value={roster.length} />
        <MetricCard label="Present" value={presentCount} tone="green" />
        <MetricCard label="Absent" value={absentCount} tone="red" />
        <MetricCard label="Flagged attempts" value={attempts.length} tone="amber" />
      </section>

      <section className="panel report-panel">
        <div className="panel-heading">
          <div><h2>Session report</h2><p className="muted">Select a session to see the full roster.</p></div>
          <button className="button button-secondary" onClick={() => void exportReport()} disabled={!selected}>Export CSV</button>
        </div>
        {loading ? <p className="empty-state">Loading sessions…</p> : sessions.length === 0 ? (
          <p className="empty-state">No sessions yet. Open a session to start tracking attendance.</p>
        ) : <>
          <label className="session-select-label">Attendance session
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {sessions.map((session) => <option key={session._id} value={session._id}>{session.title} · {sessionStatus(session)}</option>)}
            </select>
          </label>
          {selected && <div className="selected-session"><div><strong>{selected.title}</strong><p className="muted">{new Date(selected.startAt).toLocaleString()} · ends {new Date(selected.endAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p></div>
            {sessionStatus(selected) !== 'Closed' && <button className="button button-danger" onClick={() => void closeSession()}>Close session</button>}
          </div>}
          <label className="search-field">Search students<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, student ID, or room" /></label>
          <div className="table-scroll"><table><thead><tr><th>Student</th><th>Room</th><th>Status</th><th>Checked in</th></tr></thead>
            <tbody>{filteredRoster.map((record) => <tr key={record.studentId}><td><strong>{record.name}</strong><small>{record.studentId}</small></td><td>{record.roomNumber?.trim() || '—'}</td><td><span className={`status status-${record.status}`}>{record.status}</span></td><td>{record.markedAt ? new Date(record.markedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</td></tr>)}</tbody>
          </table></div>
          {filteredRoster.length === 0 && <p className="empty-state">{roster.length === 0 ? 'No students are assigned to this hostel yet.' : 'No students match your search.'}</p>}
        </>}
      </section>
      <p className="footnote">Attendance status is determined by the AttendX API. Room numbers come from the private student roster.</p>
    </main>
  );
}
