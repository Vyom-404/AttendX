import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import {
  initializeAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
  type Persistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isSuccessResponse,
} from 'react-native-nitro-google-signin';

import googleServices from '../../google-services.json';

// Firebase exposes this helper through its React Native entry point. TypeScript
// currently resolves the web declaration for firebase/auth in this Expo project.
const getReactNativePersistence = (
  FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  }
).getReactNativePersistence;

const projectInfo = googleServices.project_info;
const androidClient = googleServices.client.find(
  (client) => client.client_info.android_client_info.package_name === 'com.vyom.attendx',
);

if (!androidClient) {
  throw new Error('The Firebase Android config does not contain com.vyom.attendx.');
}

const firebaseApp = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: androidClient.api_key[0].current_key,
      appId: androidClient.client_info.mobilesdk_app_id,
      authDomain: `${projectInfo.project_id}.firebaseapp.com`,
      projectId: projectInfo.project_id,
      storageBucket: projectInfo.storage_bucket,
      messagingSenderId: projectInfo.project_number,
    });

const firebaseAuth = initializeAuth(firebaseApp, {
  persistence: getReactNativePersistence(AsyncStorage),
});

GoogleOneTapSignIn.configure({
  webClientId: 'autoDetect',
  scopes: ['email'],
});

export async function signInWithGoogle(): Promise<string> {
  await GoogleOneTapSignIn.checkPlayServices();

  const result = await GoogleOneTapSignIn.presentExplicitSignIn();
  if (isCancelledResponse(result)) {
    throw new Error('Google sign-in was cancelled.');
  }
  if (!isSuccessResponse(result) || !result.data.idToken) {
    throw new Error('Google did not return a sign-in token. Please try again.');
  }

  const credential = GoogleAuthProvider.credential(result.data.idToken);
  const userCredential = await signInWithCredential(firebaseAuth, credential);
  return userCredential.user.getIdToken(true);
}

export async function getFirebaseIdToken(): Promise<string | null> {
  await firebaseAuth.authStateReady();
  return firebaseAuth.currentUser?.getIdToken() ?? null;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(firebaseAuth);
  await GoogleOneTapSignIn.signOut();
}
