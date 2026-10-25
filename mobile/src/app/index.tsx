import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiBaseUrl } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

const colors = {
  ink: '#142536',
  muted: '#708090',
  blue: '#2563EB',
  navy: '#11263B',
  paper: '#F4F7FB',
  line: '#E2E8F0',
  white: '#FFFFFF',
};

export default function SignInScreen() {
  const { token, user, signingIn, signIn } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (token && user) router.replace(user.roles.includes('admin') ? '/admin' : '/student');
  }, [token, user]);

  async function handleSignIn() {
    setError('');
    try {
      await signIn(studentId.trim(), secret);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed. Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>A</Text></View>
            <Text style={styles.brand}>Attend<Text style={styles.brandAccent}>X</Text></Text>
            <Text style={styles.tagline}>A clearer way to mark hostel attendance.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.headingRow}>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>WELCOME BACK</Text>
                <Text style={styles.title}>Sign in to AttendX</Text>
              </View>
              <View style={styles.devPill}><Text style={styles.devPillText}>DEV</Text></View>
            </View>
            <Text style={styles.description}>
              Temporary local sign-in for the app build. Google sign-in will replace this in the next step.
            </Text>

            <Text style={styles.label}>Student ID</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setStudentId}
              placeholder="e.g. student_01"
              placeholderTextColor="#9AA7B5"
              style={styles.input}
              value={studentId}
            />
            <Text style={styles.label}>Development sign-in secret</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSecret}
              onSubmitEditing={handleSignIn}
              placeholder="Enter the local DEV_LOGIN_SECRET"
              placeholderTextColor="#9AA7B5"
              secureTextEntry
              style={styles.input}
              value={secret}
            />

            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

            <Pressable
              accessibilityRole="button"
              disabled={signingIn || !studentId.trim() || !secret}
              onPress={handleSignIn}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (signingIn || !studentId.trim() || !secret) && styles.disabled]}
            >
              {signingIn ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Continue</Text>}
            </Pressable>

            <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>NEXT UP</Text><View style={styles.dividerLine} /></View>
            <View style={styles.googlePlaceholder}>
              <Text style={styles.googleIcon}>G</Text>
              <View style={styles.googleCopy}>
                <Text style={styles.googleTitle}>Google sign-in</Text>
                <Text style={styles.googleSub}>We’ll connect this after the app setup.</Text>
              </View>
              <Text style={styles.comingSoon}>SOON</Text>
            </View>
          </View>

          <Text style={styles.apiLabel}>API · {getApiBaseUrl()}</Text>
          <Text style={styles.footer}>AttendX · hostel attendance</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  page: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 38, paddingBottom: 28 },
  hero: { alignItems: 'center', marginBottom: 32 },
  brandMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brandMarkText: { color: colors.white, fontWeight: '900', fontSize: 27, letterSpacing: -2 },
  brand: { color: colors.ink, fontSize: 27, fontWeight: '800', letterSpacing: -1.2 },
  brandAccent: { color: colors.blue },
  tagline: { color: colors.muted, fontSize: 14, marginTop: 5 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#E9EEF4', shadowColor: '#18324D', shadowOpacity: 0.07, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.blue, fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: 8 },
  title: { color: colors.ink, fontSize: 25, lineHeight: 31, fontWeight: '700', letterSpacing: -0.7 },
  devPill: { backgroundColor: '#FFF4D8', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, marginLeft: 10 },
  devPillText: { color: '#98620A', fontWeight: '800', fontSize: 10, letterSpacing: 0.8 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 23 },
  label: { color: colors.ink, fontWeight: '700', fontSize: 13, marginBottom: 8, marginTop: 14 },
  input: { height: 50, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, color: colors.ink, backgroundColor: '#FBFCFE', fontSize: 14 },
  error: { color: '#B42318', backgroundColor: '#FFF0EE', borderRadius: 10, padding: 12, marginTop: 14, fontSize: 13, lineHeight: 19 },
  primaryButton: { height: 52, backgroundColor: colors.navy, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 23 },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 11, marginVertical: 22 },
  dividerLine: { height: 1, flex: 1, backgroundColor: colors.line },
  dividerText: { color: '#98A5B3', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  googlePlaceholder: { minHeight: 56, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FBFCFE' },
  googleIcon: { width: 29, height: 29, borderRadius: 9, backgroundColor: '#EEF3FA', color: colors.blue, textAlign: 'center', textAlignVertical: 'center', fontSize: 17, fontWeight: '800', overflow: 'hidden' },
  googleCopy: { flex: 1 },
  googleTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  googleSub: { color: colors.muted, fontSize: 11, marginTop: 3 },
  comingSoon: { color: '#8996A5', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  apiLabel: { color: '#93A0AE', fontSize: 10, textAlign: 'center', marginTop: 22 },
  footer: { color: '#93A0AE', fontSize: 11, textAlign: 'center', marginTop: 'auto', paddingTop: 22 },
});
