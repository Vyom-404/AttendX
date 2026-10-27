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

import { BrandMark } from '@/components/BrandMark';
import { useAuth } from '@/providers/auth-provider';

const colors = {
  ink: '#2B1D36',
  muted: '#8B7D8E',
  accent: '#FF795F',
  deep: '#2B1D36',
  paper: '#F7F1E8',
  line: '#EAE0D8',
  white: '#FFFCF7',
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
          <ActivityIndicator color={colors.accent} />
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
            <BrandMark size={76} />
            <Text style={styles.brand}>Attend<Text style={styles.brandAccent}>X</Text></Text>
            <Text style={styles.tagline}>Show up. You’re counted.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.headingRow}>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>{Platform.OS === 'web' ? 'WARDEN DESK' : 'YOUR RESIDENCE'}</Text>
                <Text style={styles.title}>Welcome in</Text>
              </View>
            </View>
            <Text style={styles.description}>
              {Platform.OS === 'web'
                ? 'Continue with the Google account connected to your warden access.'
                : 'Sign in with the Google account linked to your attendance profile.'}
            </Text>

            {!!(error || authError) && <Text accessibilityRole="alert" style={styles.error}>{error || authError}</Text>}

            <Pressable
              accessibilityRole="button"
              disabled={signingIn}
              onPress={handleGoogleSignIn}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, signingIn && styles.disabled]}
            >
              {signingIn ? <ActivityIndicator color={colors.white} /> : <Text style={styles.googleG}>G</Text>}
              {!signingIn && <Text style={styles.primaryButtonText}>Continue with Google</Text>}
            </Pressable>
            <Text style={styles.finePrint}>Your account is verified securely with Google.</Text>
          </View>

          <Text style={styles.footer}>ATTENDANCE, WITHOUT THE FUSS</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  page: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 28 },
  hero: { alignItems: 'center', marginBottom: 30, gap: 10 },
  brand: { color: colors.ink, fontSize: 33, fontWeight: '900', letterSpacing: -1.8, marginTop: 4 },
  brandAccent: { color: colors.accent },
  tagline: { color: colors.muted, fontSize: 14, marginTop: 0, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: colors.white, borderRadius: 28, padding: 26, borderWidth: 1, borderColor: colors.line, shadowColor: '#2B1D36', shadowOpacity: 0.08, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 4 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.7, marginBottom: 8 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 33, fontWeight: '800', letterSpacing: -1 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 11, marginBottom: 21 },
  error: { color: '#A43F45', backgroundColor: '#FFF0EC', borderColor: '#F2D3CC', borderWidth: 1, borderRadius: 13, padding: 12, marginTop: 14, fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 56, backgroundColor: colors.deep, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, paddingHorizontal: 16, marginTop: 22 },
  googleG: { color: '#F6C66B', fontSize: 19, fontWeight: '900' },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  finePrint: { color: '#9B8F9B', fontSize: 11, textAlign: 'center', marginTop: 15 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
  footer: { color: '#A89AA6', fontSize: 9, fontWeight: '800', letterSpacing: 1.8, textAlign: 'center', marginTop: 27 },
});
