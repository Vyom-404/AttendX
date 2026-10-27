import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

type Session = { _id: string; title: string; startAt: string; endAt: string; status: string };
type AttendanceRecord = { _id: string; sessionId: string; sessionTitle: string; markedAt: string; status: string };

const C = {
  ink: '#2B1D36',
  muted: '#897B8B',
  purple: '#3A2947',
  deep: '#2B1D36',
  coral: '#FF795F',
  butter: '#F2C36B',
  paper: '#F7F1E8',
  white: '#FFFCF7',
  line: '#EAE0D8',
  success: '#477569',
  error: '#A43F45',
};

export default function StudentHome() {
  const { token, user, signOut } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const [active, history] = await Promise.all([
        apiRequest<{ session: Session | null }>('/sessions/active', token),
        apiRequest<{ records: AttendanceRecord[] }>('/attendance/me?limit=50', token),
      ]);
      setSession(active.session);
      setRecords(history.records || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your attendance.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  const markedRecord = session
    ? records.find((record) => record.sessionId === session._id && record.status === 'present')
    : undefined;

  async function logout() {
    setSigningOut(true);
    setError('');
    try {
      await signOut();
      router.replace('/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void loadData(); }}
            tintColor={C.success}
          />
        }
      >
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <BrandMark size={44} />
            <Text style={styles.brand}>Attend<Text style={styles.brandAccent}>X</Text></Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={signingOut} onPress={() => void logout()} style={styles.avatar}>
            {signingOut ? <ActivityIndicator color={C.success} /> : <Text style={styles.avatarText}>{user?.name?.slice(0, 1).toUpperCase() || 'S'}</Text>}
          </Pressable>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.eyebrow}>YOUR ATTENDANCE</Text>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.name || 'Student'}</Text>
        </View>

        {!!error && <View style={styles.errorCard} accessibilityRole="alert"><Text style={styles.feedbackIcon}>!</Text><View style={styles.feedbackCopy}><Text style={styles.errorTitle}>We couldn’t refresh your attendance</Text><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => { setLoading(true); void loadData(); }}><Text style={styles.retryText}>Try again</Text></Pressable></View></View>}

        <View style={[styles.sessionCard, markedRecord && styles.sessionCardDone]}>
          <View style={styles.cardHeader}>
            <View><Text style={[styles.cardEyebrow, markedRecord && styles.cardEyebrowDone]}>YOUR CHECK-IN</Text><Text style={styles.sessionTitle}>{loading ? 'Checking for an open roll call…' : session?.title || 'Nothing to check into'}</Text></View>
            <View style={[styles.livePill, !session && styles.idlePill]}><View style={[styles.liveDot, !session && styles.idleDot]} /><Text style={[styles.liveText, !session && styles.idleText]}>{session ? 'LIVE' : 'WAITING'}</Text></View>
          </View>

          {loading ? <ActivityIndicator color={C.butter} style={styles.loadingIndicator} /> : session ? <>
            <Text style={styles.sessionTime}>{new Date(session.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} <Text style={styles.timeDash}>—</Text> {new Date(session.endAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
            {markedRecord ? <View style={styles.markedPanel}>
              <View style={styles.markedIcon}><Text style={styles.markedCheck}>✓</Text></View>
              <View style={styles.markedCopy}><Text style={styles.markedTitle}>You’re all checked in</Text><Text style={styles.markedTime}>Marked at {new Date(markedRecord.markedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text></View>
            </View> : <>
              <View style={styles.cardDivider} />
              <View style={styles.hintRow}><Text style={styles.hintIcon}>↗</Text><Text style={styles.hintText}>Use the in-app camera while you’re at the hostel. Your photo and location are checked securely.</Text></View>
              <Pressable accessibilityRole="button" onPress={() => router.push('/capture')} style={({ pressed }) => [styles.checkInButton, pressed && styles.pressed]}>
                <Text style={styles.checkInButtonText}>Mark attendance</Text><Text style={styles.buttonArrow}>→</Text>
              </Pressable>
            </>}
          </> : <Text style={styles.emptySessionText}>Your warden hasn’t opened a session yet. Pull down to check again.</Text>}
        </View>

        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Your history</Text><Text style={styles.sectionSub}>Recent check-ins</Text></View></View>
        {!loading && records.length === 0 ? <View style={styles.emptyHistory}><View style={styles.emptyIcon}><Text style={styles.emptyIconText}>↗</Text></View><Text style={styles.emptyTitle}>A clean slate</Text><Text style={styles.emptyText}>Your attendance history will appear here after your first check-in.</Text></View> : records.map((record) => (
          <View key={record._id} style={styles.recordRow}>
            <View style={styles.recordIcon}><Text style={styles.recordCheck}>✓</Text></View>
            <View style={styles.recordInfo}><Text style={styles.recordTitle}>{record.sessionTitle}</Text><Text style={styles.recordDate}>{new Date(record.markedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {new Date(record.markedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text></View>
            <Text style={styles.presentPill}>Present</Text>
          </View>
        ))}
        <Text style={styles.footer}>Made for your residence · AttendX</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 35 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { color: C.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.9 },
  brandAccent: { color: C.coral },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EADDF0', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.deep, fontWeight: '800', fontSize: 16 },
  greetingBlock: { marginBottom: 23 },
  eyebrow: { color: C.success, fontSize: 9, letterSpacing: 1.7, fontWeight: '900', marginBottom: 10 },
  greeting: { color: C.muted, fontSize: 15, fontWeight: '500' },
  name: { color: C.ink, fontSize: 35, lineHeight: 41, letterSpacing: -1.5, fontWeight: '900', marginTop: 2 },
  sessionCard: { backgroundColor: C.deep, borderRadius: 28, padding: 22, marginBottom: 31, overflow: 'hidden' },
  sessionCardDone: { backgroundColor: '#3E2B4D' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardEyebrow: { color: '#D6C9D9', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  cardEyebrowDone: { color: C.butter },
  sessionTitle: { color: C.white, fontSize: 21, lineHeight: 27, fontWeight: '700', marginTop: 8, maxWidth: 270 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#523A5E' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.coral },
  liveText: { color: '#FFD2BE', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  idlePill: { backgroundColor: '#44334F' },
  idleDot: { backgroundColor: '#B7A9BC' },
  idleText: { color: '#E2D8E5' },
  sessionTime: { color: '#E7DDE8', fontSize: 12, marginTop: 7, fontWeight: '600' },
  timeDash: { color: '#C1AEC7' },
  loadingIndicator: { alignSelf: 'flex-start', marginTop: 24 },
  cardDivider: { height: 1, backgroundColor: '#574760', marginTop: 18, marginBottom: 14 },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  hintIcon: { color: C.butter, fontSize: 17, fontWeight: '800', marginTop: -2 },
  hintText: { color: '#E5DCE8', fontSize: 12, lineHeight: 18, flex: 1 },
  checkInButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, paddingHorizontal: 17, minHeight: 54, marginTop: 19, backgroundColor: C.coral },
  checkInButtonText: { color: C.deep, fontSize: 13, fontWeight: '900' },
  buttonArrow: { color: C.deep, fontSize: 19, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  markedPanel: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#554063', borderRadius: 17, padding: 14, marginTop: 18 },
  markedIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.butter, alignItems: 'center', justifyContent: 'center' },
  markedCheck: { color: C.deep, fontSize: 18, fontWeight: '900' },
  markedCopy: { flex: 1 },
  markedTitle: { color: C.white, fontWeight: '800', fontSize: 13 },
  markedTime: { color: '#D9CFDE', fontSize: 10, marginTop: 3 },
  emptySessionText: { color: '#E5DCE8', fontSize: 12, lineHeight: 18, marginTop: 14 },
  errorCard: { flexDirection: 'row', gap: 11, backgroundColor: '#FFF0EA', borderColor: '#F0D3C9', borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 16 },
  feedbackIcon: { color: C.error, fontSize: 16, fontWeight: '900' },
  feedbackCopy: { flex: 1 },
  errorTitle: { color: C.error, fontWeight: '800', fontSize: 12, marginBottom: 4 },
  errorText: { color: '#82463D', fontSize: 11, lineHeight: 16 },
  retryText: { color: C.error, fontWeight: '800', fontSize: 11, marginTop: 8 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 13 },
  sectionTitle: { color: C.ink, fontWeight: '900', fontSize: 18, letterSpacing: -0.4 },
  sectionSub: { color: C.muted, fontSize: 11, marginTop: 4 },
  emptyHistory: { alignItems: 'center', backgroundColor: '#EFE6ED', borderRadius: 20, padding: 25 },
  emptyIcon: { width: 40, height: 40, borderRadius: 15, backgroundColor: '#E4D5E4', alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  emptyIconText: { color: C.deep, fontSize: 20, fontWeight: '700' },
  emptyTitle: { color: C.ink, fontSize: 13, fontWeight: '800' },
  emptyText: { color: C.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5, maxWidth: 260 },
  recordRow: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  recordIcon: { width: 36, height: 36, backgroundColor: '#E3EEE9', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  recordCheck: { color: C.success, fontWeight: '900', fontSize: 16 },
  recordInfo: { flex: 1 },
  recordTitle: { color: C.ink, fontWeight: '800', fontSize: 12 },
  recordDate: { color: C.muted, fontSize: 10, marginTop: 4 },
  presentPill: { color: C.success, backgroundColor: '#E3EEE9', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '900' },
  footer: { color: '#9AA398', textAlign: 'center', fontSize: 9, letterSpacing: 0.4, marginTop: 21 },
});
