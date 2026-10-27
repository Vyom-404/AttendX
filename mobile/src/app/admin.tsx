import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { apiDownload, apiRequest } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

type AdminSession = { _id: string; title: string; startAt: string; endAt: string; status: string };
type RosterRecord = { attendanceId: string | null; studentId: string; name: string; roomNumber?: string | null; status: 'present' | 'absent'; markedAt: string | null };

const C = { ink: '#2B1D36', muted: '#897B8B', blue: '#51405E', navy: '#2B1D36', paper: '#F7F1E8', white: '#FFFCF7', line: '#EAE0D8', green: '#477569', red: '#A43F45', coral: '#FF795F' };

function sessionState(session: AdminSession) {
  const now = Date.now();
  if (session.status === 'closed' || now >= new Date(session.endAt).getTime()) return 'Closed';
  if (now < new Date(session.startAt).getTime()) return 'Upcoming';
  return 'Open';
}

export default function AdminDashboard() {
  const { token, user, signOut } = useAuth();
  const isAdmin = Boolean(user?.roles.includes('admin'));
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [roster, setRoster] = useState<RosterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('Hostel attendance');
  const [duration, setDuration] = useState('60');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSessions = useCallback(async () => {
    if (!token || !isAdmin) return;
    setError('');
    try {
      const result = await apiRequest<{ sessions: AdminSession[] }>('/admin/sessions', token);
      const list = result.sessions || [];
      setSessions(list);
      setSelectedId((current) => current && list.some((item) => item._id === current) ? current : list[0]?._id || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load sessions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, isAdmin]);

  const loadReport = useCallback(async (id: string) => {
    if (!token || !id) { setRoster([]); return; }
    try {
      const attendance = await apiRequest<{ records: RosterRecord[] }>(`/admin/sessions/${id}/attendance`, token);
      setRoster(attendance.records || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this session report.');
    }
  }, [token]);

  // Fetching here syncs the screen with the API; updates happen after the network promise resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadSessions(); }, [loadSessions]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadReport(selectedId); }, [selectedId, loadReport]);

  const selected = sessions.find((session) => session._id === selectedId);
  const presentCount = roster.filter((record) => record.status === 'present').length;
  const absentCount = roster.filter((record) => record.status === 'absent').length;
  const filteredRoster = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return roster;
    return roster.filter((student) => `${student.name} ${student.roomNumber || ''}`.toLowerCase().includes(needle));
  }, [roster, search]);

  async function createSession() {
    const minutes = Number(duration);
    if (!title.trim() || !Number.isFinite(minutes) || minutes < 5 || minutes > 720) {
      setError('Add a title and choose a duration between 5 minutes and 12 hours.');
      return;
    }
    setCreating(true);
    setError('');
    setNotice('');
    const startAt = new Date();
    try {
      const result = await apiRequest<{ session: AdminSession }>('/admin/sessions', token || undefined, {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), startAt: startAt.toISOString(), endAt: new Date(startAt.getTime() + minutes * 60_000).toISOString() }),
      });
      setSessions((current) => [result.session, ...current]);
      setSelectedId(result.session._id);
      setShowCreate(false);
      setNotice('Attendance session opened.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the session.');
    } finally {
      setCreating(false);
    }
  }

  async function closeSession() {
    if (!selected || !token) return;
    setError('');
    try {
      const result = await apiRequest<{ session: AdminSession }>(`/admin/sessions/${selected._id}`, token, {
        method: 'PATCH', body: JSON.stringify({ status: 'closed' }),
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
      const csv = await apiDownload(`/admin/sessions/${selected._id}/export`, token);
      if (Platform.OS !== 'web') {
        setNotice('CSV export is available from the web dashboard.');
        return;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
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

  async function logout() {
    setError('');
    try {
      await signOut();
      router.replace('/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign out. Please try again.');
    }
  }

  if (!isAdmin) {
    return <SafeAreaView style={styles.safe}><View style={styles.centered}><Text style={styles.deniedTitle}>Admin access required</Text><Text style={styles.mutedText}>Sign in with an account that has the admin role, or return to sign-in.</Text><Pressable onPress={() => router.replace('/')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Back to sign in</Text></Pressable></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSessions(); }} />}>
        <View style={styles.header}>
          <View style={styles.brandGroup}><BrandMark size={42} /><Text style={styles.brand}>Attend<Text style={{ color: C.coral }}>X</Text></Text></View>
          <View style={styles.headerRight}><View style={styles.adminChip}><View style={styles.onlineDot} /><Text style={styles.adminChipText}>Warden</Text></View><Pressable onPress={logout} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable></View>
        </View>

        <View style={styles.welcomeRow}><View style={{ flex: 1 }}><Text style={styles.kicker}>WARDEN DESK</Text><Text style={styles.pageTitle}>Hello, {user?.name?.split(' ')[0] || 'Warden'}</Text><Text style={styles.subtitle}>A quick look at who’s here.</Text></View><Pressable onPress={() => { setShowCreate((value) => !value); setError(''); }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{showCreate ? 'Cancel' : '+  Start roll call'}</Text></Pressable></View>

        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {!!notice && <Pressable onPress={() => setNotice('')}><Text style={styles.notice}>{notice}  ×</Text></Pressable>}

        {showCreate && <View style={styles.createCard}><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Open an attendance session</Text><Text style={styles.sectionHint}>It starts now and closes automatically after the duration.</Text></View></View><View style={styles.formRow}><View style={styles.formField}><Text style={styles.fieldLabel}>SESSION TITLE</Text><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Evening roll call" placeholderTextColor="#99A5B1" style={styles.input} /></View><View style={[styles.formField, styles.durationField]}><Text style={styles.fieldLabel}>DURATION · MINUTES</Text><TextInput value={duration} onChangeText={setDuration} keyboardType="number-pad" style={styles.input} /></View><Pressable disabled={creating} onPress={createSession} style={[styles.createButton, creating && styles.dimmed]}>{creating ? <ActivityIndicator color={C.white} /> : <Text style={styles.primaryButtonText}>Open session</Text>}</Pressable></View></View>}

        <View style={styles.metricsRow}>
          <Metric label="ROSTER" value={String(roster.length)} tint="#EEE4F1" icon="⌂" />
          <Metric label="PRESENT" value={String(presentCount)} tint="#E3EEE9" icon="✓" green />
          <Metric label="AWAY" value={String(absentCount)} tint="#FCE8E0" icon="–" red />
        </View>

        <View style={styles.contentCard}>
          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>Session report</Text><Text style={styles.sectionHint}>Choose a session to view the full hostel roster.</Text></View>
            <Pressable onPress={exportReport} disabled={!selected} style={[styles.exportButton, !selected && styles.dimmed]}><Text style={styles.exportButtonText}>↓  Export CSV</Text></Pressable>
          </View>
          {loading ? <View style={styles.loading}><ActivityIndicator color={C.blue} /><Text style={styles.mutedText}>Loading sessions…</Text></View> : sessions.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyTitle}>No sessions yet</Text><Text style={styles.mutedText}>Create an attendance session to begin tracking present and absent students.</Text></View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionChips}>
                {sessions.map((session) => {
                  const state = sessionState(session);
                  const active = session._id === selectedId;
                  return <Pressable key={session._id} onPress={() => { setSelectedId(session._id); setError(''); }} style={[styles.sessionChip, active && styles.sessionChipSelected]}><View style={[styles.sessionStateDot, { backgroundColor: state === 'Open' ? C.green : state === 'Upcoming' ? '#D08B52' : '#B8A8B9' }]} /><View><Text numberOfLines={1} style={[styles.sessionChipTitle, active && styles.sessionChipTextSelected]}>{session.title}</Text><Text style={[styles.sessionChipMeta, active && styles.sessionChipMetaSelected]}>{state} · {new Date(session.startAt).toLocaleDateString()}</Text></View></Pressable>;
                })}
              </ScrollView>

              {selected && <View style={styles.selectedSessionBar}><View style={{ flex: 1 }}><Text style={styles.selectedTitle}>{selected.title}</Text><Text style={styles.selectedMeta}>{new Date(selected.startAt).toLocaleString()}  ·  until {new Date(selected.endAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text></View>{sessionState(selected) !== 'Closed' && <Pressable onPress={closeSession} style={styles.closeButton}><Text style={styles.closeButtonText}>Close session</Text></Pressable>}</View>}

              <View style={styles.searchWrap}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Find a student or room" placeholderTextColor="#A899A6" style={styles.searchInput} /></View>
              <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
                <View style={styles.rosterTable}>
                  <View style={styles.tableHeader}><Text style={[styles.tableHeadCell, styles.studentColumn]}>STUDENT</Text><Text style={[styles.tableHeadCell, styles.roomColumn]}>ROOM</Text><Text style={[styles.tableHeadCell, styles.statusColumn]}>STATUS</Text><Text style={[styles.tableHeadCell, styles.timeColumn]}>CHECKED IN</Text></View>
                  {filteredRoster.length === 0 ? <View style={styles.emptyRoster}><Text style={styles.mutedText}>{roster.length === 0 ? 'No students are assigned to this hostel yet.' : 'No students match this search.'}</Text></View> : filteredRoster.map((record) => <RosterRow key={record.studentId} record={record} />)}
                  <View style={styles.tableFooter}><Text style={styles.tableFooterText}>Showing {filteredRoster.length} of {roster.length} students</Text><Text style={styles.tableFooterText}>Updated just now</Text></View>
                </View>
              </ScrollView>
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, tint, icon, green, red }: { label: string; value: string; tint: string; icon: string; green?: boolean; red?: boolean }) {
  const color = green ? C.green : red ? C.red : C.blue;
  return <View style={styles.metric}><View style={[styles.metricIcon, { backgroundColor: tint }]}><Text style={{ color, fontWeight: '900', fontSize: 17 }}>{icon}</Text></View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function RosterRow({ record }: { record: RosterRecord }) {
  const present = record.status === 'present';
  return <View style={styles.rosterRow}><View style={styles.studentColumn}><Text style={styles.studentName}>{record.name}</Text></View><Text style={[styles.roomCell, styles.roomColumn]}>{record.roomNumber?.trim() || '—'}</Text><View style={[styles.statusColumn, styles.statusAlign]}><View style={[styles.statusBadge, present ? styles.presentBadge : styles.absentBadge]}><View style={[styles.badgeDot, { backgroundColor: present ? C.green : C.red }]} /><Text style={[styles.badgeText, { color: present ? C.green : C.red }]}>{present ? 'Present' : 'Away'}</Text></View></View><Text style={[styles.timeCell, styles.timeColumn]}>{record.markedAt ? new Date(record.markedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper }, page: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 24, paddingBottom: 50 },
  header: { minHeight: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 17, marginBottom: 31 }, brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 11 }, brand: { color: C.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.7 }, headerRight: { flexDirection: 'row', alignItems: 'center', gap: 13 }, adminChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#E6EEE8' }, onlineDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: C.green }, adminChipText: { color: C.green, fontSize: 11, fontWeight: '800' }, signOut: { padding: 9 }, signOutText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  welcomeRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 23 }, kicker: { color: C.blue, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 }, pageTitle: { color: C.ink, fontSize: 30, lineHeight: 37, letterSpacing: -1.2, fontWeight: '900' }, subtitle: { color: C.muted, fontSize: 13, marginTop: 7 }, primaryButton: { backgroundColor: C.navy, minHeight: 43, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, primaryButtonText: { color: C.white, fontSize: 12, fontWeight: '700' },
  error: { color: '#A43F45', backgroundColor: '#F7E1D9', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: '#F2D3CC', marginBottom: 13, fontSize: 12 }, notice: { color: C.green, backgroundColor: '#E6EEE8', paddingVertical: 10, paddingHorizontal: 13, borderRadius: 10, marginBottom: 13, fontSize: 12, overflow: 'hidden' }, createCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 17, marginBottom: 18 }, formRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 11, flexWrap: 'wrap', marginTop: 15 }, formField: { flex: 1, minWidth: 200 }, durationField: { flex: 0.45, minWidth: 135 }, fieldLabel: { color: C.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1, marginBottom: 7 }, input: { height: 42, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 11, color: C.ink, fontSize: 12, backgroundColor: '#FFFCF7' }, createButton: { height: 42, minWidth: 120, backgroundColor: C.navy, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' }, dimmed: { opacity: 0.5 },
  metricsRow: { flexDirection: 'row', gap: 13, marginBottom: 20, flexWrap: 'wrap' }, metric: { flex: 1, minWidth: 145, backgroundColor: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 15, padding: 15, minHeight: 123 }, metricIcon: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, metricValue: { color: C.ink, fontSize: 26, lineHeight: 31, fontWeight: '800', marginTop: 11, letterSpacing: -0.7 }, metricLabel: { color: C.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginTop: 2 },
  contentCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 18 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { color: C.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }, sectionHint: { color: C.muted, fontSize: 11, marginTop: 4 }, exportButton: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 }, exportButtonText: { color: C.ink, fontWeight: '700', fontSize: 10 }, sessionChips: { gap: 8, paddingTop: 16, paddingBottom: 14 }, sessionChip: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11, minWidth: 150, maxWidth: 230, backgroundColor: '#FFFCF7' }, sessionChipSelected: { borderColor: '#D7C7DD', backgroundColor: '#F0E8F0' }, sessionStateDot: { width: 7, height: 7, borderRadius: 4 }, sessionChipTitle: { color: C.ink, fontWeight: '700', fontSize: 11 }, sessionChipTextSelected: { color: '#51405E' }, sessionChipMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, sessionChipMetaSelected: { color: '#8B7D8E' }, selectedSessionBar: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#EEE5EF', borderBottomWidth: 1, borderBottomColor: '#EEE5EF', paddingVertical: 13 }, selectedTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, selectedMeta: { color: C.muted, fontSize: 10, marginTop: 4 }, closeButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: '#F7E1D9' }, closeButtonText: { color: C.red, fontSize: 10, fontWeight: '700' },
  searchWrap: { height: 40, borderWidth: 1, borderColor: C.line, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, marginTop: 14, marginBottom: 10, backgroundColor: '#FFFCF7' }, searchIcon: { color: C.muted, fontSize: 19, marginRight: 7 }, searchInput: { color: C.ink, flex: 1, fontSize: 11, height: '100%' }, rosterTable: { minWidth: 590 }, tableHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 10, paddingHorizontal: 5 }, tableHeadCell: { color: '#9B8E9C', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 }, studentColumn: { flex: 2.4, minWidth: 150 }, roomColumn: { flex: 0.7, minWidth: 65 }, statusColumn: { flex: 1.1, minWidth: 95 }, statusAlign: { alignItems: 'flex-start' }, timeColumn: { flex: 1.05, minWidth: 90, textAlign: 'right' }, rosterRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEE8E2', paddingHorizontal: 5, gap: 8 }, studentName: { color: C.ink, fontSize: 11, fontWeight: '700' }, roomCell: { color: C.ink, fontSize: 11 }, statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 }, presentBadge: { backgroundColor: '#E6EEE8' }, absentBadge: { backgroundColor: '#F7E1D9' }, badgeDot: { width: 5, height: 5, borderRadius: 3 }, badgeText: { fontSize: 9, fontWeight: '800' }, timeCell: { color: C.muted, fontSize: 10, textAlign: 'right' }, tableFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 }, tableFooterText: { color: '#9B8E9C', fontSize: 9 }, emptyRoster: { paddingVertical: 24, alignItems: 'center' }, loading: { paddingVertical: 40, alignItems: 'center', gap: 10 }, empty: { alignItems: 'center', paddingVertical: 43, paddingHorizontal: 20 }, emptyTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginBottom: 6 }, mutedText: { color: C.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' }, centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, deniedTitle: { color: C.ink, fontSize: 22, fontWeight: '800', marginBottom: 10 },
});
