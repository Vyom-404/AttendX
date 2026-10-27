import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

type Session = { _id: string; title: string; startAt: string; endAt: string; status: string };
type AttendanceRecord = { _id: string; sessionId: string; sessionTitle: string; markedAt: string; status: string };

const C = {
  ink: '#18352E',
  muted: '#73847D',
  green: '#1D604B',
  greenDeep: '#153F35',
  lime: '#D9F17F',
  paper: '#F5F3EB',
  white: '#FFFFFF',
  line: '#E7E8DD',
  success: '#187653',
  error: '#9D3931',
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
            tintColor={C.green}
          />
        }
      >
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>A</Text></View>
            <View><Text style={styles.brand}>Attend<Text style={styles.brandAccent}>X</Text></Text><Text style={styles.brandCaption}>RESIDENCE LIFE</Text></View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={signingOut} onPress={() => void logout()} style={styles.avatar}>
            {signingOut ? <ActivityIndicator color={C.green} /> : <Text style={styles.avatarText}>{user?.name?.slice(0, 1).toUpperCase() || 'S'}</Text>}
          </Pressable>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.eyebrow}>YOUR ATTENDANCE</Text>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.name || 'Student'}</Text>
          <View style={styles.identityRow}><Text style={styles.studentId}>{user?.studentId}</Text><View style={styles.identityDot} /><Text style={styles.identityText}>Student account</Text></View>
        </View>

        {!!error && <View style={styles.errorCard} accessibilityRole="alert"><Text style={styles.feedbackIcon}>!</Text><View style={styles.feedbackCopy}><Text style={styles.errorTitle}>We couldn’t refresh your attendance</Text><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => { setLoading(true); void loadData(); }}><Text style={styles.retryText}>Try again</Text></Pressable></View></View>}

        <View style={[styles.sessionCard, markedRecord && styles.sessionCardDone]}>
          <View style={styles.cardHeader}>
            <View><Text style={[styles.cardEyebrow, markedRecord && styles.cardEyebrowDone]}>CURRENT SESSION</Text><Text style={styles.sessionTitle}>{loading ? 'Checking today’s session…' : session?.title || 'No active session'}</Text></View>
            <View style={[styles.livePill, !session && styles.idlePill]}><View style={[styles.liveDot, !session && styles.idleDot]} /><Text style={[styles.liveText, !session && styles.idleText]}>{session ? 'LIVE' : 'WAITING'}</Text></View>
          </View>

          {loading ? <ActivityIndicator color={C.lime} style={styles.loadingIndicator} /> : session ? <>
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

        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Recent activity</Text><Text style={styles.sectionSub}>Your latest check-ins</Text></View><Text style={styles.historyCount}>{records.length} {records.length === 1 ? 'RECORD' : 'RECORDS'}</Text></View>
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
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 34 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  brandMarkText: { color: C.lime, fontSize: 23, fontWeight: '900' },
  brand: { color: C.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.8 },
  brandAccent: { color: C.success },
  brandCaption: { color: C.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 },
  avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#E5EBDD', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.green, fontWeight: '800', fontSize: 16 },
  greetingBlock: { marginBottom: 23 },
  eyebrow: { color: C.success, fontSize: 9, letterSpacing: 1.7, fontWeight: '900', marginBottom: 10 },
  greeting: { color: C.muted, fontSize: 16, fontWeight: '500' },
  name: { color: C.ink, fontSize: 34, lineHeight: 40, letterSpacing: -1.5, fontWeight: '800', marginTop: 2 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  studentId: { color: C.muted, fontSize: 11, fontWeight: '700' },
  identityDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#9DA99B' },
  identityText: { color: C.muted, fontSize: 11 },
  sessionCard: { backgroundColor: C.greenDeep, borderRadius: 25, padding: 21, marginBottom: 30, overflow: 'hidden' },
  sessionCardDone: { backgroundColor: '#174C3C' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardEyebrow: { color: '#B9CEBF', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  cardEyebrowDone: { color: C.lime },
  sessionTitle: { color: C.white, fontSize: 21, lineHeight: 27, fontWeight: '700', marginTop: 8, maxWidth: 270 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#244F3F' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.lime },
  liveText: { color: C.lime, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  idlePill: { backgroundColor: '#344C43' },
  idleDot: { backgroundColor: '#A7B7AA' },
  idleText: { color: '#CBD5CC' },
  sessionTime: { color: '#D3E0D6', fontSize: 12, marginTop: 7, fontWeight: '600' },
  timeDash: { color: '#90AE9B' },
  loadingIndicator: { alignSelf: 'flex-start', marginTop: 24 },
  cardDivider: { height: 1, backgroundColor: '#35584A', marginTop: 18, marginBottom: 14 },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  hintIcon: { color: C.lime, fontSize: 17, fontWeight: '800', marginTop: -2 },
  hintText: { color: '#D3E0D6', fontSize: 11, lineHeight: 17, flex: 1 },
  checkInButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingHorizontal: 16, minHeight: 52, marginTop: 19, backgroundColor: C.lime },
  checkInButtonText: { color: C.greenDeep, fontSize: 13, fontWeight: '900' },
  buttonArrow: { color: C.greenDeep, fontSize: 19, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  markedPanel: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#28624D', borderRadius: 16, padding: 14, marginTop: 18 },
  markedIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
  markedCheck: { color: C.greenDeep, fontSize: 18, fontWeight: '900' },
  markedCopy: { flex: 1 },
  markedTitle: { color: C.white, fontWeight: '800', fontSize: 13 },
  markedTime: { color: '#C2D6C7', fontSize: 10, marginTop: 3 },
  emptySessionText: { color: '#D3E0D6', fontSize: 12, lineHeight: 18, marginTop: 14 },
  errorCard: { flexDirection: 'row', gap: 11, backgroundColor: '#FFF0EA', borderColor: '#F0D3C9', borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 16 },
  feedbackIcon: { color: C.error, fontSize: 16, fontWeight: '900' },
  feedbackCopy: { flex: 1 },
  errorTitle: { color: C.error, fontWeight: '800', fontSize: 12, marginBottom: 4 },
  errorText: { color: '#82463D', fontSize: 11, lineHeight: 16 },
  retryText: { color: C.error, fontWeight: '800', fontSize: 11, marginTop: 8 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 13 },
  sectionTitle: { color: C.ink, fontWeight: '900', fontSize: 18, letterSpacing: -0.4 },
  sectionSub: { color: C.muted, fontSize: 11, marginTop: 4 },
  historyCount: { color: C.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  emptyHistory: { alignItems: 'center', backgroundColor: '#ECEDE4', borderRadius: 18, padding: 24 },
  emptyIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#DEE3D5', alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  emptyIconText: { color: C.green, fontSize: 20, fontWeight: '700' },
  emptyTitle: { color: C.ink, fontSize: 13, fontWeight: '800' },
  emptyText: { color: C.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5, maxWidth: 260 },
  recordRow: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  recordIcon: { width: 36, height: 36, backgroundColor: '#E5F0E6', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  recordCheck: { color: C.success, fontWeight: '900', fontSize: 16 },
  recordInfo: { flex: 1 },
  recordTitle: { color: C.ink, fontWeight: '800', fontSize: 12 },
  recordDate: { color: C.muted, fontSize: 10, marginTop: 4 },
  presentPill: { color: C.success, backgroundColor: '#E7F2E8', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '900' },
  footer: { color: '#9AA398', textAlign: 'center', fontSize: 9, letterSpacing: 0.4, marginTop: 21 },
});
