import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

type Session = { _id: string; title: string; startAt: string; endAt: string; status: string };
type AttendanceRecord = { _id: string; sessionTitle: string; markedAt: string; status: string };

const C = { ink: '#152638', muted: '#748395', blue: '#2E6DE5', navy: '#12283E', paper: '#F4F7FB', white: '#FFFFFF', line: '#E5EAF0', green: '#17865B', amber: '#A36304' };

export default function StudentHome() {
  const { token, user, signOut } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const [active, history] = await Promise.all([
        apiRequest<{ session: Session | null }>('/sessions/active', token),
        apiRequest<{ records: AttendanceRecord[] }>('/attendance/me?limit=5', token),
      ]);
      setSession(active.session);
      setRecords(history.records);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your attendance.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Refresh after returning from the camera flow so a successful check-in appears immediately.
  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  function logout() {
    signOut();
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
        <View style={styles.topbar}>
          <View><Text style={styles.brand}>Attend<Text style={{ color: C.blue }}>X</Text></Text><Text style={styles.kicker}>STUDENT SPACE</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={logout} style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.slice(0, 1).toUpperCase() || 'S'}</Text></Pressable>
        </View>

        <Text style={styles.greeting}>Good day,</Text>
        <Text style={styles.name}>{user?.name || 'Student'}</Text>
        <Text style={styles.studentId}>{user?.studentId}</Text>

        <View style={styles.sessionCard}>
          <View style={styles.cardTop}><View><Text style={styles.cardEyebrow}>TODAY&apos;S ATTENDANCE</Text><Text style={styles.sessionTitle}>{session?.title || 'No active session'}</Text></View><View style={[styles.statusDot, { backgroundColor: session ? '#2EC68A' : '#ADB8C4' }]} /></View>
          {loading ? <ActivityIndicator color={C.blue} style={{ alignSelf: 'flex-start', marginTop: 22 }} /> : session ? (
            <>
              <Text style={styles.sessionTime}>{new Date(session.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – {new Date(session.endAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
              <View style={styles.notice}><Text style={styles.noticeIcon}>i</Text><Text style={styles.noticeText}>Attendance uses an in-app camera capture and your current hostel location.</Text></View>
              <Pressable accessibilityRole="button" onPress={() => router.push('/capture')} style={styles.checkInButton}><Text style={styles.checkInButtonText}>Open camera to check in</Text></Pressable>
            </>
          ) : <Text style={styles.emptyText}>When an admin opens a session, it will appear here with its attendance window.</Text>}
        </View>

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Recent attendance</Text><Text style={styles.sectionSub}>Your personal history</Text></View>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!loading && records.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Nothing recorded yet</Text><Text style={styles.emptyText}>Your attendance records will show here after a session.</Text></View> : records.map((record) => (
          <View key={record._id} style={styles.recordRow}><View style={styles.recordIcon}><Text style={styles.check}>✓</Text></View><View style={{ flex: 1 }}><Text style={styles.recordTitle}>{record.sessionTitle}</Text><Text style={styles.recordDate}>{new Date(record.markedAt).toLocaleString()}</Text></View><Text style={styles.presentPill}>Present</Text></View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper }, page: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: 22, paddingBottom: 48 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 33 }, brand: { fontSize: 21, fontWeight: '800', color: C.ink, letterSpacing: -0.8 }, kicker: { fontSize: 9, letterSpacing: 1.6, color: C.muted, fontWeight: '800', marginTop: 4 }, avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#E0EAFE', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.blue, fontWeight: '800', fontSize: 17 },
  greeting: { fontSize: 15, color: C.muted }, name: { fontSize: 31, lineHeight: 38, letterSpacing: -1, fontWeight: '800', color: C.ink, marginTop: 2 }, studentId: { color: C.muted, fontSize: 12, marginTop: 4, marginBottom: 23 },
  sessionCard: { backgroundColor: C.navy, borderRadius: 22, padding: 21, marginBottom: 29, overflow: 'hidden' }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, cardEyebrow: { color: '#AFC1D3', fontSize: 9, fontWeight: '800', letterSpacing: 1.3 }, sessionTitle: { color: C.white, fontSize: 21, lineHeight: 27, fontWeight: '700', marginTop: 8 }, statusDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 }, sessionTime: { color: '#DBE5EF', fontSize: 13, marginTop: 8 }, notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderTopWidth: 1, borderColor: '#31485E', marginTop: 20, paddingTop: 16 }, noticeIcon: { color: '#B4D0FF', borderColor: '#6480A0', borderWidth: 1, borderRadius: 8, width: 17, height: 17, textAlign: 'center', fontWeight: '800', fontSize: 11, overflow: 'hidden' }, noticeText: { color: '#D0DCE8', fontSize: 12, lineHeight: 18, flex: 1 }, checkInButton: { backgroundColor: '#FFFFFF', borderRadius: 13, padding: 15, marginTop: 18, alignItems: 'center' }, checkInButtonText: { color: C.navy, fontSize: 14, fontWeight: '800' }, emptyText: { color: '#B7C4D2', fontSize: 13, lineHeight: 19, marginTop: 15 },
  sectionHeading: { marginBottom: 13 }, sectionTitle: { color: C.ink, fontWeight: '800', fontSize: 19, letterSpacing: -0.4 }, sectionSub: { color: C.muted, fontSize: 12, marginTop: 4 }, error: { color: '#B42318', backgroundColor: '#FFF0EE', padding: 12, borderRadius: 10, marginBottom: 12 }, emptyCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 18 }, emptyTitle: { color: C.ink, fontSize: 14, fontWeight: '700' }, recordRow: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 9 }, recordIcon: { width: 34, height: 34, backgroundColor: '#E4F7EF', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, check: { color: C.green, fontWeight: '900', fontSize: 16 }, recordTitle: { color: C.ink, fontWeight: '700', fontSize: 13 }, recordDate: { color: C.muted, fontSize: 10, marginTop: 4 }, presentPill: { color: C.green, backgroundColor: '#E4F7EF', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '800' },
});
