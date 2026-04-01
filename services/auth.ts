import {
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
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

  // In production, you need a RecaptchaVerifier.
  // For now this is a placeholder — real implementation needs
  // expo-dev-client or a custom dev build.
  throw new Error('Production Firebase Phone Auth requires RecaptchaVerifier setup');
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

  await confirmationResult.confirm(code);
  return true;
}

export async function signOut(): Promise<void> {
  if (Config.DEV_MOCK_AUTH) {
    mockPhone = null;
    return;
  }
  await firebaseSignOut(auth);
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
