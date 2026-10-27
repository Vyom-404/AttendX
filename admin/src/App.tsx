import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiRequest, downloadReport } from './api/client';
import type { AdminSession, RosterRecord } from './api/types';
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
      <div className="signin-story">
        <img className="story-logo" src="/attendx-mark.svg" alt="" />
        <p className="story-kicker">A LITTLE LESS ROLL CALL.</p>
        <h2>More time<br />for your people.</h2>
        <p className="story-copy">Open attendance, see the room at a glance, and get on with the evening.</p>
        <div className="story-stamp"><span>✓</span><div><strong>All in one place</strong><small>Sessions · Rooms · Check-ins</small></div></div>
      </div>
      <section className="signin-card">
        <div className="signin-wordmark"><img className="signin-logo" src="/attendx-mark.svg" alt="" /><strong>Attend<span className="brand-accent">X</span></strong></div>
        <p className="eyebrow">WARDEN DESK</p>
        <h1>Welcome in.</h1>
        <p className="muted">Use the Google account connected to your warden access.</p>
        {error && <p className="error-banner" role="alert">{error}</p>}
        <button className="button button-primary button-wide" onClick={handleSignIn} disabled={signingIn}>
          {signingIn ? 'Signing in…' : 'Continue with Google'}
        </button>
      </section>
    </main>
  );
}

function Dashboard() {
  const { token, user, signOut, error: authError } = useAuth();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [roster, setRoster] = useState<RosterRecord[]>([]);
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
      return;
    }
    try {
      const attendance = await apiRequest<{ records: RosterRecord[] }>(`/admin/sessions/${sessionId}/attendance`, token);
      setRoster(attendance.records || []);
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
      `${record.name} ${record.roomNumber || ''}`.toLowerCase().includes(query),
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
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-brand"><img src="/attendx-mark.svg" alt="" /><span>Attend<span className="brand-accent">X</span></span></div>
        <div className="sidebar-intro"><span className="side-label">WARDEN DESK</span><strong>Attendance,<br />at a glance.</strong></div>
        <div className="sidebar-bottom"><span className="sidebar-dot" />Your residence workspace</div>
      </aside>
      <main className="dashboard-shell">
      <header className="topbar">
        <span className="topbar-label">YOUR OVERVIEW</span>
        <div className="account-actions"><span className="account-name">{user?.name}</span><button className="button button-quiet" onClick={() => { void signOut().catch(() => undefined); }}>Sign out</button></div>
      </header>

      <section className="page-heading">
        <div><p className="eyebrow">GOOD TO SEE YOU</p><h1>Hello, {user?.name?.split(' ')[0] || 'Warden'}.</h1><p className="muted">A clear view of today’s attendance.</p></div>
        <button className="button button-primary" onClick={() => { setShowCreate((value) => !value); setError(''); }}>{showCreate ? 'Cancel' : '+ Start roll call'}</button>
      </section>

      {(error || authError) && <p className="error-banner" role="alert">{error || authError}</p>}
      {notice && <button className="notice-banner" onClick={() => setNotice('')}>{notice} ×</button>}

      {showCreate && <section className="panel create-panel">
        <div><h2>Open an attendance session</h2><p className="muted">It starts now and closes after the selected duration.</p></div>
        <label>Session title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Evening roll call" /></label>
        <label>Duration in minutes<input type="number" min="5" max="720" value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
        <button className="button button-primary" onClick={() => void createSession()} disabled={busy}>{busy ? 'Opening…' : 'Open session'}</button>
      </section>}

      <section className="metrics-grid" aria-label="Attendance totals">
        <MetricCard label="On the roster" value={roster.length} />
        <MetricCard label="Checked in" value={presentCount} tone="green" />
        <MetricCard label="Not yet here" value={absentCount} tone="red" />
      </section>

      <section className="panel report-panel">
        <div className="panel-heading">
          <div><h2>The roll call</h2><p className="muted">Choose a session to see who’s in.</p></div>
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
          <label className="search-field">Find someone<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or room number" /></label>
          <div className="table-scroll"><table><thead><tr><th>Student</th><th>Room</th><th>Status</th><th>Checked in</th></tr></thead>
            <tbody>{filteredRoster.map((record) => <tr key={record.studentId}><td><strong>{record.name}</strong></td><td>{record.roomNumber?.trim() || '—'}</td><td><span className={`status status-${record.status}`}>{record.status === 'present' ? 'Here' : 'Away'}</span></td><td>{record.markedAt ? new Date(record.markedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</td></tr>)}</tbody>
          </table></div>
          {filteredRoster.length === 0 && <p className="empty-state">{roster.length === 0 ? 'No students are assigned to this hostel yet.' : 'No students match your search.'}</p>}
        </>}
      </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, tone = 'blue' }: { label: string; value: number; tone?: string }) {
  return <article className={`metric-card metric-${tone}`}><p>{label}</p><strong>{value}</strong></article>;
}
