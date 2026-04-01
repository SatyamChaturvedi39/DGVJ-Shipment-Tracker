import {
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  ConfirmationResult,
} from 'firebase/auth';
import { auth } from './firebase';
import { Config } from '@/constants/config';

let confirmationResult: ConfirmationResult | null = null;
let mockPhone: string | null = null;

export async function sendOTP(phoneNumber: string): Promise<void> {
  if (Config.DEV_MOCK_AUTH) {
    mockPhone = phoneNumber;
    return;
  }

  // phoneNumber must include country code, e.g. +919876543210
  // RecaptchaVerifier is required for web-based Firebase Phone Auth.
  // For Expo managed workflow use expo-dev-client with @react-native-firebase,
  // or implement a custom RecaptchaVerifier for the JS SDK.
  // See: https://firebase.google.com/docs/auth/web/phone-auth
  try {
    // NOTE: replace `recaptchaVerifier` with a real ApplicationVerifier instance
    // confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    throw new Error(
      'RecaptchaVerifier not yet configured. Set up expo-dev-client or implement ApplicationVerifier.'
    );
  } catch (e: any) {
    console.error('[Firebase] sendOTP failed:', e?.message ?? e);
    throw e;
  }
}

export async function verifyOTP(code: string): Promise<boolean> {
  if (Config.DEV_MOCK_AUTH) {
    if (code === '123456') {
      return true;
    }
    throw new Error('Invalid OTP. Use 123456 in dev mode.');
  }

  if (!confirmationResult) {
    throw new Error('No OTP request found. Call sendOTP first.');
  }

  try {
    await confirmationResult.confirm(code);
    return true;
  } catch (e: any) {
    console.error('[Firebase] verifyOTP failed:', e?.message ?? e);
    throw e;
  }
}

export async function signOut(): Promise<void> {
  if (Config.DEV_MOCK_AUTH) {
    mockPhone = null;
    return;
  }
  try {
    await firebaseSignOut(auth);
  } catch (e: any) {
    console.error('[Firebase] signOut failed:', e?.message ?? e);
    throw e;
  }
}

export async function getIdToken(): Promise<string | null> {
  if (Config.DEV_MOCK_AUTH) {
    return 'dev-mock-token';
  }
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export function getMockPhone(): string | null {
  return mockPhone;
}
