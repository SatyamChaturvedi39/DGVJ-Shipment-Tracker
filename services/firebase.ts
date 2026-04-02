// IMPORTANT: Before this works in production, you must:
// 1. Enable Phone Authentication in Firebase Console → Authentication → Sign-in method
// 2. Add your Android SHA-1 fingerprint in Firebase Console → Project Settings → Your apps → Android app
//    (see .env.example for how to get your SHA-1)
// 3. Fill in all EXPO_PUBLIC_FIREBASE_* values in your .env file

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

// Singleton pattern — only initialize once across hot reloads
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// initializeAuth throws if called twice, so guard it too
let auth: ReturnType<typeof initializeAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Already initialized — get the existing instance
  auth = getAuth(app);
}

export { app, auth };
