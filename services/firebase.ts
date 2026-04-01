// IMPORTANT: Before this works in production, you must:
// 1. Enable Phone Authentication in Firebase Console → Authentication → Sign-in method
// 2. Add your Android SHA-1 fingerprint in Firebase Console → Project Settings → Your apps → Android app
//    (see .env.example for how to get your SHA-1)
// 3. Replace the placeholder config values below with your real Firebase project config

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
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
