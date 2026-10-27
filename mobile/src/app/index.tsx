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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiBaseUrl } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

const colors = {
  ink: '#18352E',
  muted: '#73847D',
  blue: '#1D604B',
  navy: '#153F35',
  paper: '#F5F3EB',
  line: '#E7E8DD',
  white: '#FFFFFF',
};

export default function SignInScreen() {
  const { token, user, authReady, signingIn, signInGoogle, authError } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    if (token && user) router.replace(user.roles.includes('admin') ? '/admin' : '/student');
  }, [token, user]);

  async function handleGoogleSignIn() {
    setError('');
    try {
      await signInGoogle();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Google sign-in failed. Please try again.');
    }
  }

  if (!authReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingPage}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.description}>Checking your AttendX sign-in…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroOrb}><View style={styles.brandMark}><Text style={styles.brandMarkText}>A</Text></View></View>
            <Text style={styles.brand}>Attend<Text style={styles.brandAccent}>X</Text></Text>
            <Text style={styles.brandCaption}>RESIDENCE LIFE · MADE SIMPLE</Text>
            <Text style={styles.tagline}>A calmer, clearer way to keep hostel attendance.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.headingRow}>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>{Platform.OS === 'web' ? 'WARDEN ACCESS' : 'WELCOME BACK'}</Text>
                <Text style={styles.title}>Sign in to AttendX</Text>
              </View>
              <View style={styles.googlePill}>
                <Text style={styles.googlePillText}>GOOGLE</Text>
              </View>
            </View>
            <Text style={styles.description}>
              {Platform.OS === 'web'
                ? 'Use the Google account linked to your AttendX warden account.'
                : 'Use the Google account linked to your AttendX student or warden account.'}
            </Text>

            {!!(error || authError) && <Text accessibilityRole="alert" style={styles.error}>{error || authError}</Text>}

            <Pressable
              accessibilityRole="button"
              disabled={signingIn}
              onPress={handleGoogleSignIn}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, signingIn && styles.disabled]}
            >
              {signingIn ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Continue with Google</Text>}
            </Pressable>
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
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 38, paddingBottom: 28 },
  hero: { alignItems: 'center', marginBottom: 32 },
  heroOrb: { width: 76, height: 76, borderRadius: 27, backgroundColor: '#E5EBDD', alignItems: 'center', justifyContent: 'center', marginBottom: 13, transform: [{ rotate: '-4deg' }] },
  brandMark: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#D9F17F', fontWeight: '900', fontSize: 27, letterSpacing: -2 },
  brand: { color: colors.ink, fontSize: 29, fontWeight: '900', letterSpacing: -1.5 },
  brandAccent: { color: colors.blue },
  brandCaption: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.6, marginTop: 5 },
  tagline: { color: colors.muted, fontSize: 13, marginTop: 11, textAlign: 'center', lineHeight: 19 },
  card: { backgroundColor: colors.white, borderRadius: 25, padding: 24, borderWidth: 1, borderColor: '#E9E9DE', shadowColor: '#18352E', shadowOpacity: 0.07, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.blue, fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: 8 },
  title: { color: colors.ink, fontSize: 25, lineHeight: 31, fontWeight: '700', letterSpacing: -0.7 },
  googlePill: { backgroundColor: '#E5F0E6', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, marginLeft: 10 },
  googlePillText: { color: colors.blue, fontWeight: '800', fontSize: 10, letterSpacing: 0.8 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 23 },
  error: { color: '#9D3931', backgroundColor: '#FFF0EA', borderColor: '#F0D3C9', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14, fontSize: 13, lineHeight: 19 },
  primaryButton: { height: 52, backgroundColor: colors.navy, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 23 },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
  apiLabel: { color: '#93A0AE', fontSize: 10, textAlign: 'center', marginTop: 22 },
  footer: { color: '#93A0AE', fontSize: 11, textAlign: 'center', marginTop: 'auto', paddingTop: 22 },
});
