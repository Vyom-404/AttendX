export async function signInWithGoogle(): Promise<string> {
  throw new Error('Google sign-in on the web will be connected after registering the Firebase Web app.');
}

export async function getFirebaseIdToken(): Promise<string | null> {
  return null;
}

export async function signOutFirebase(): Promise<void> {}
