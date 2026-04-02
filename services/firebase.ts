// IMPORTANT: Before this works in production, you must:
// 1. Enable Phone Authentication in Firebase Console → Authentication → Sign-in method
// 2. Add your Android SHA-1 fingerprint in Firebase Console → Project Settings → Your apps → Android app
//    (see .env.example for how to get your SHA-1)
// 3. Replace the placeholder config values below with your real Firebase project config

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDJmoDva7xbAWzFtmIog_G6CzHgb8buyDk',
  authDomain: 'dvgj-shipment-tracker.firebaseapp.com',
  projectId: 'dvgj-shipment-tracker',
  storageBucket: 'dvgj-shipment-tracker.firebasestorage.app',
  messagingSenderId: '826777981400',
  appId: '1:826777981400:web:1326801ce977b2507762ad',
  measurementId: 'G-G60M8YKTJG',
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
