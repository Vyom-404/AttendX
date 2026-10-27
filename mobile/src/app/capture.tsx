import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { File } from 'expo-file-system';

import { apiRequest } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

type Capture = { uri: string; name: string };
type AttendanceResult = { status: 'present'; markedAt: string };

const COLORS = { ink: '#18352E', muted: '#73847D', blue: '#1D604B', navy: '#153F35', paper: '#F5F3EB', white: '#FFFFFF', line: '#E7E8DD', red: '#9D3931', lime: '#D9F17F' };
type Feedback = { kind: 'info' | 'error' | 'success'; text: string };

export default function CaptureScreen() {
  const { token } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [success, setSuccess] = useState(false);
  const [locationSettingsNeeded, setLocationSettingsNeeded] = useState(false);

  async function captureSequence() {
    if (!cameraRef.current || !cameraReady || working) return;
    setWorking(true);
    setFeedback(null);
    try {
      const freshCaptures: Capture[] = [];
      for (let index = 0; index < 3; index += 1) {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.75, skipProcessing: false });
        if (!photo?.uri) throw new Error('The camera did not return a photo. Try again.');
        freshCaptures.push({ uri: photo.uri, name: `capture_${index + 1}.jpg` });
        if (index < 2) await new Promise((resolve) => setTimeout(resolve, 650));
      }
      setCaptures(freshCaptures);
      setFeedback({ kind: 'success', text: 'Three camera frames captured. Submit them while staying in the attendance area.' });
    } catch (reason) {
      setFeedback({ kind: 'error', text: reason instanceof Error ? reason.message : 'Could not capture the photos. Please try again.' });
    } finally {
      setWorking(false);
    }
  }

  async function submitAttendance() {
    if (!token || captures.length !== 3 || working) return;
    setWorking(true);
    setFeedback({ kind: 'info', text: 'Getting a fresh location and checking your attendance…' });
    try {
      const permissionResult = locationPermission?.granted
        ? locationPermission
        : await requestLocationPermission();
      if (!permissionResult.granted) {
        setLocationSettingsNeeded(!permissionResult.canAskAgain);
        throw new Error(permissionResult.canAskAgain
          ? 'Location permission is needed to check that you are at the hostel.'
          : 'Location permission is blocked. Open app settings and allow location while using the app.');
      }
      setLocationSettingsNeeded(false);
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!location.coords.accuracy || location.coords.accuracy <= 0) {
        throw new Error('Your phone could not get an accurate location. Move near a window or outdoors and try again.');
      }

      const active = await apiRequest<{ session: { _id: string } | null }>('/sessions/active', token);
      if (!active.session) throw new Error('There is no active attendance session right now.');

      const form = new FormData();
      form.append('sessionId', active.session._id);
      form.append('latitude', String(location.coords.latitude));
      form.append('longitude', String(location.coords.longitude));
      form.append('accuracyMeters', String(location.coords.accuracy));
      form.append('locationTimestamp', new Date(location.timestamp).toISOString());
      for (const capture of captures) {
        if (Platform.OS === 'web') {
          const response = await fetch(capture.uri);
          form.append('captures', await response.blob(), capture.name);
        } else {
          form.append('captures', new File(capture.uri), capture.name);
        }
      }

      await apiRequest<AttendanceResult>('/attendance', token, { method: 'POST', body: form });
      setSuccess(true);
      setFeedback({ kind: 'success', text: 'Attendance marked successfully.' });
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : 'Could not submit attendance. Please try again.';
      setFeedback({ kind: 'error', text: detail });
    } finally {
      setWorking(false);
    }
  }

  if (!permission) {
    return <ScreenFrame><ActivityIndicator color={COLORS.blue} /></ScreenFrame>;
  }

  if (!permission.granted) {
    return (
      <ScreenFrame>
        <Text style={styles.eyebrow}>ATTENDANCE CHECK</Text>
        <Text style={styles.title}>Allow camera access</Text>
        <Text style={styles.copy}>AttendX takes three fresh frames directly from the front camera. It does not offer a gallery picker.</Text>
        <Pressable onPress={() => { void requestPermission().catch((reason) => setFeedback({ kind: 'error', text: reason instanceof Error ? reason.message : 'Could not request camera access.' })); }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Allow camera</Text></Pressable>
        {feedback && <Text accessibilityRole="alert" style={styles.errorMessage}>{feedback.text}</Text>}
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Go back</Text></Pressable>
      </ScreenFrame>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹  Back</Text></Pressable>
        <Text style={styles.eyebrow}>ATTENDANCE CHECK</Text>
        <Text style={styles.title}>{success ? 'You’re checked in' : 'Take your live selfie'}</Text>
        <Text style={styles.copy}>{success ? 'Your identity and hostel location were checked by AttendX.' : 'Face the camera in clear, even lighting. Three frames are captured directly from the front camera.'}</Text>

        {!success && <View style={styles.locationStatus}>
          <Text style={styles.locationStatusTitle}>Location access</Text>
          <Text style={styles.locationStatusText}>
            {locationPermission === null ? 'Checking permission…' : locationPermission.granted
              ? 'Allowed. The system prompt appears only when location access has not already been granted.'
              : 'Needed when you submit. Android will ask when you tap “Check location & submit”.'}
          </Text>
        </View>}

        {!success && <View style={styles.cameraFrame}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
            animateShutter={false}
            onCameraReady={() => setCameraReady(true)}
          />
          <View pointerEvents="none" style={styles.faceGuide} />
        </View>}

        {feedback && <Text accessibilityRole={feedback.kind === 'error' ? 'alert' : undefined} style={[styles.message, feedback.kind === 'success' && styles.success, feedback.kind === 'error' && styles.errorMessage]}>{feedback.text}</Text>}

        {locationSettingsNeeded && <Pressable onPress={() => Linking.openSettings()} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Open app settings</Text>
        </Pressable>}

        {!success && captures.length < 3 && <Pressable disabled={!cameraReady || working} onPress={captureSequence} style={[styles.primaryButton, (!cameraReady || working) && styles.disabled]}>
          {working ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>{cameraReady ? 'Capture 3 frames' : 'Starting camera…'}</Text>}
        </Pressable>}

        {!success && captures.length === 3 && <>
          <Text style={styles.captureCount}>✓  3 camera frames ready</Text>
          <Pressable disabled={working} onPress={submitAttendance} style={[styles.primaryButton, working && styles.disabled]}>
            {working ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Check location & submit</Text>}
          </Pressable>
          <Pressable disabled={working} onPress={() => { setCaptures([]); setFeedback(null); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Retake photos</Text></Pressable>
        </>}

        {success && <Pressable onPress={() => router.replace('/student')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Back to attendance</Text></Pressable>}
        <Text style={styles.privacyNote}>Your current location is checked by the server against the hostel geofence when you submit.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ScreenFrame({ children }: React.PropsWithChildren) {
  return <SafeAreaView style={styles.safe}><View style={styles.permissionPage}>{children}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.paper },
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 22, paddingBottom: 42 },
  permissionPage: { flex: 1, justifyContent: 'center', alignItems: 'stretch', padding: 24 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 2, marginBottom: 16 },
  backText: { color: COLORS.blue, fontWeight: '800', fontSize: 14 },
  eyebrow: { color: COLORS.blue, fontSize: 10, letterSpacing: 1.5, fontWeight: '900', marginBottom: 7 },
  title: { color: COLORS.ink, fontWeight: '900', fontSize: 29, letterSpacing: -1 },
  copy: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 18 },
  locationStatus: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 15, marginBottom: 15 },
  locationStatusTitle: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  locationStatusText: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  cameraFrame: { height: 440, maxHeight: '58%', minHeight: 300, borderRadius: 28, overflow: 'hidden', backgroundColor: '#10251F', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: COLORS.white },
  camera: { ...StyleSheet.absoluteFill },
  faceGuide: { width: 220, height: 290, borderRadius: 130, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  message: { color: COLORS.ink, backgroundColor: '#E9EEE4', borderRadius: 13, padding: 13, marginTop: 14, fontSize: 13, lineHeight: 19 },
  success: { color: '#176044', backgroundColor: '#E4F0E4', borderColor: '#C9DDC8', borderWidth: 1 },
  errorMessage: { color: COLORS.red, backgroundColor: '#FFF0EA', borderColor: '#F0D3C9', borderWidth: 1, borderRadius: 13, padding: 13, marginTop: 14, fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 54, borderRadius: 15, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 14 },
  primaryButtonText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  secondaryButton: { minHeight: 45, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryText: { color: COLORS.blue, fontSize: 13, fontWeight: '700' },
  captureCount: { color: '#126747', fontSize: 13, fontWeight: '700', marginTop: 15 },
  privacyNote: { color: COLORS.muted, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 19 },
});
