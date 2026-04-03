import {
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  ConfirmationResult,
  ApplicationVerifier,
} from 'firebase/auth';
import { auth } from './firebase';
import { Config } from '@/constants/config';

let confirmationResult: ConfirmationResult | null = null;
let mockPhone: string | null = null;

// Firebase test phone numbers bypass real reCAPTCHA validation on the server.
// This minimal verifier satisfies the SDK's type requirement without needing a DOM.
// Only works with numbers registered under Firebase Console → Authentication →
// Sign-in method → Phone → Phone numbers for testing.
const fakeRecaptchaVerifier: ApplicationVerifier & { _reset?: () => void } = {
  type: 'recaptcha',
  verify: () => Promise.resolve('fake-recaptcha-token'),
  _reset: () => {},
};

export async function sendOTP(phoneNumber: string): Promise<void> {
  if (Config.DEV_MOCK_AUTH) {
    mockPhone = phoneNumber;
    return;
  }

  // phoneNumber must include country code, e.g. +919876543210
  try {
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, fakeRecaptchaVerifier);
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
    return mockPhone ? `dev-mock-token:${mockPhone}` : 'dev-mock-token';
  }
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export function getMockPhone(): string | null {
  return mockPhone;
}
