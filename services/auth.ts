import {
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  ConfirmationResult,
  ApplicationVerifier,
} from 'firebase/auth';
import { auth } from './firebase';
import { Config } from '@/constants/config';

// ── Dev-only helpers (Expo Go / mock mode) ────────────────────────────────────

let confirmationResult: ConfirmationResult | null = null;
let mockPhone: string | null = null;

// Satisfies the SDK type requirement without needing a DOM or real reCAPTCHA.
// Only works with numbers registered under Firebase Console → Phone → Test numbers.
// Used exclusively when Config.DEV_MOCK_AUTH is true (Expo Go dev flow).
const fakeRecaptchaVerifier: ApplicationVerifier & { _reset?: () => void } = {
  type: 'recaptcha',
  verify: () => Promise.resolve('fake-recaptcha-token'),
  _reset: () => {},
};

// ── Production OTP (native @react-native-firebase) ────────────────────────────

// Lazy-loaded so that Expo Go (which lacks the native module) doesn't crash.
// In production EAS builds, @react-native-firebase/auth is always available.
let nativeConfirmation: { confirm: (code: string) => Promise<unknown> } | null = null;

async function sendOTPNative(phoneNumber: string): Promise<void> {
  // Dynamic import avoids crashing Expo Go where the native module is absent
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

  // Detect whether the native @react-native-firebase module is available.
  // RNFBAuthModule is present in NativeModules only in EAS builds (native APK).
  // In Expo Go the native module is not linked, so NativeModules.RNFBAuthModule is undefined.
  let nativeAvailable = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeModules } = require('react-native');
    nativeAvailable = !!NativeModules.RNFBAuthModule;
  } catch {
    nativeAvailable = false;
  }

  if (nativeAvailable) {
    // Native build (EAS) — use native Firebase SDK directly.
    // Do NOT fall back to JS SDK; it cannot send real SMS.
    try {
      await sendOTPNative(phoneNumber);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Firebase Native] sendOTP failed:', msg);
      throw new Error(msg || 'Failed to send OTP via native Firebase');
    }
  } else {
    // Expo Go — use JS SDK with fakeRecaptcha (only works with Firebase test numbers)
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

  // Try native path first (EAS build)
  if (nativeConfirmation) {
    return verifyOTPNative(code);
  }

  // Fallback: JS SDK path (Expo Go + Firebase test numbers)
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
  try {
    await signOutNative();
  } catch {
    // Fallback: JS SDK
    try {
      await firebaseSignOut(auth);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Firebase] signOut failed:', msg);
    }
  }
}

export async function getIdToken(): Promise<string | null> {
  if (Config.DEV_MOCK_AUTH) {
    return mockPhone ? `dev-mock-token:${mockPhone}` : 'dev-mock-token';
  }
  // Try native path first (EAS build)
  try {
    const token = await getIdTokenNative();
    if (token) return token;
  } catch {
    // Native module not available — fall through to JS SDK
  }
  // JS SDK fallback (Expo Go)
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export function getMockPhone(): string | null {
  return mockPhone;
}
