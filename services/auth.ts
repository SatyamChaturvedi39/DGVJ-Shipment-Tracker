import {
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  ConfirmationResult,
  ApplicationVerifier,
} from 'firebase/auth';
import { NativeModules } from 'react-native';
import { auth } from './firebase';
import { Config } from '@/constants/config';

// Check once at module load time — avoids repeated require() calls that
// trigger RNFBNativeEventEmitter and crash Expo Go with the error overlay.
// RNFBAuthModule is only present in NativeModules when the app is a real
// EAS native build. In Expo Go it is undefined.
export const NATIVE_FIREBASE_AVAILABLE = !!NativeModules.RNFBAuthModule;

// ── Dev-only helpers (Expo Go / mock mode) ────────────────────────────────────

let confirmationResult: ConfirmationResult | null = null;
let mockPhone: string | null = null;

// Satisfies the SDK type requirement without needing a DOM or real reCAPTCHA.
// Only works with numbers registered under Firebase Console → Phone → Test numbers.
// Used exclusively when Config.DEV_MOCK_AUTH is false but running in Expo Go.
const fakeRecaptchaVerifier: ApplicationVerifier & { _reset?: () => void } = {
  type: 'recaptcha',
  verify: () => Promise.resolve('fake-recaptcha-token'),
  _reset: () => {},
};

// ── Production OTP (native @react-native-firebase) ────────────────────────────

// Only called when NATIVE_FIREBASE_AVAILABLE is true (EAS builds).
let nativeConfirmation: { confirm: (code: string) => Promise<unknown> } | null = null;

async function sendOTPNative(phoneNumber: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rnfirebase = require('@react-native-firebase/auth');
  const rnAuth = (rnfirebase.default ?? rnfirebase)();
  nativeConfirmation = await rnAuth.signInWithPhoneNumber(phoneNumber);
}

async function verifyOTPNative(code: string): Promise<boolean> {
  if (!nativeConfirmation) {
    throw new Error('No OTP request found. Call sendOTP first.');
  }
  await nativeConfirmation.confirm(code);
  return true;
}

async function getIdTokenNative(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rnfirebase = require('@react-native-firebase/auth');
  const rnAuth = (rnfirebase.default ?? rnfirebase)();
  const user = rnAuth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

async function signOutNative(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rnfirebase = require('@react-native-firebase/auth');
  const rnAuth = (rnfirebase.default ?? rnfirebase)();
  await rnAuth.signOut();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendOTP(phoneNumber: string): Promise<void> {
  if (Config.DEV_MOCK_AUTH) {
    mockPhone = phoneNumber;
    return;
  }

  if (NATIVE_FIREBASE_AVAILABLE) {
    // Native EAS build — real SMS via @react-native-firebase
    try {
      await sendOTPNative(phoneNumber);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Firebase Native] sendOTP failed:', msg);
      throw new Error(msg || 'Failed to send OTP via native Firebase');
    }
  } else {
    // Expo Go — JS SDK with fakeRecaptcha (only works with Firebase test numbers)
    try {
      confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, fakeRecaptchaVerifier);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Firebase JS] sendOTP failed:', msg);
      throw e;
    }
  }
}

export async function verifyOTP(code: string): Promise<boolean> {
  if (Config.DEV_MOCK_AUTH) {
    if (code === '123456') {
      return true;
    }
    throw new Error('Invalid OTP. Use 123456 in dev mode.');
  }

  // Native path (EAS build)
  if (nativeConfirmation) {
    return verifyOTPNative(code);
  }

  // JS SDK path (Expo Go + Firebase test numbers)
  if (!confirmationResult) {
    throw new Error('No OTP request found. Call sendOTP first.');
  }
  try {
    await confirmationResult.confirm(code);
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Firebase] verifyOTP failed:', msg);
    throw e;
  }
}

export async function signOut(): Promise<void> {
  if (Config.DEV_MOCK_AUTH) {
    mockPhone = null;
    return;
  }
  if (NATIVE_FIREBASE_AVAILABLE) {
    try {
      await signOutNative();
    } catch (e: unknown) {
      console.error('[Firebase Native] signOut failed:', e);
    }
  } else {
    try {
      await firebaseSignOut(auth);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Firebase JS] signOut failed:', msg);
    }
  }
}

export async function getIdToken(): Promise<string | null> {
  if (Config.DEV_MOCK_AUTH) {
    return mockPhone ? `dev-mock-token:${mockPhone}` : 'dev-mock-token';
  }
  // Native path (EAS build only — not called in Expo Go)
  if (NATIVE_FIREBASE_AVAILABLE) {
    try {
      const token = await getIdTokenNative();
      if (token) return token;
    } catch (e: unknown) {
      console.error('[Firebase Native] getIdToken failed:', e);
    }
  }
  // JS SDK path (Expo Go)
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export function getMockPhone(): string | null {
  return mockPhone;
}
