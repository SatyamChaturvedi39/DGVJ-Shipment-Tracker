import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Config } from '@/constants/config';
import type { User } from '@/types';

const TOKEN_KEY          = 'auth_token';
const REMEMBERED_PHONE_KEY = 'remembered_phone';

// Phone stored in memory for the current login attempt
let pendingLoginPhone: string | null = null;

// ── Token storage ─────────────────────────────────────────────────────────────

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function storeToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ── Remembered phone (Remember Me feature) ────────────────────────────────────

export async function saveRememberedPhone(phone: string): Promise<void> {
  await AsyncStorage.setItem(REMEMBERED_PHONE_KEY, phone);
}

export async function getRememberedPhone(): Promise<string | null> {
  return AsyncStorage.getItem(REMEMBERED_PHONE_KEY);
}

export async function clearRememberedPhone(): Promise<void> {
  await AsyncStorage.removeItem(REMEMBERED_PHONE_KEY);
}

// ── getIdToken — called by the API interceptor ─────────────────────────────

export async function getIdToken(): Promise<string | null> {
  if (Config.DEV_MOCK_AUTH) {
    return pendingLoginPhone
      ? `dev-mock-token:${pendingLoginPhone}`
      : 'dev-mock-token';
  }
  return getStoredToken();
}

// ── Login flow ─────────────────────────────────────────────────────────────────

/**
 * Step 1 — phone screen.
 * Calls /auth/check-phone to check if user exists and has a PIN set.
 * Returns 'needs_pin' (go to verify screen) or 'first_login' (go to setup-pin screen).
 * In dev mode: skips the network call and always returns 'needs_pin'.
 */
export async function loginWithPhone(phone: string): Promise<'needs_pin' | 'first_login'> {
  pendingLoginPhone = phone;
  if (Config.DEV_MOCK_AUTH) return 'needs_pin';
  const { data } = await axios.post(`${Config.API_BASE_URL}/auth/check-phone`, { phone });
  return data.status as 'needs_pin' | 'first_login';
}

/**
 * Step 2 — PIN screen.
 * In dev mode: accepts any 4-digit PIN, stores mock token, returns admin profile via /users/me.
 * In production: calls POST /auth/login, stores JWT, returns user from response.
 */
export async function loginWithPin(phone: string, pin: string): Promise<User> {
  if (Config.DEV_MOCK_AUTH) {
    pendingLoginPhone = phone;
    // Store mock token so the API interceptor has something to send
    await storeToken(`dev-mock-token:${phone}`);
    // getMe() is called in AuthContext after loginWithPin — that will return admin user
    // For dev mode we just need the token stored; return a stub that AuthContext ignores
    // by calling getMe() itself. So throw if PIN isn't 4 digits to give useful feedback.
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      throw new Error('PIN must be exactly 4 digits.');
    }
    // Return profile via /users/me (uses the mock token just stored)
    const { data } = await axios.get(`${Config.API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer dev-mock-token:${phone}` },
    });
    return data;
  }

  const { data } = await axios.post(`${Config.API_BASE_URL}/auth/login`, { phone, pin });
  await storeToken(data.token);
  return data.user as User;
}

// ── Sign out ───────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  pendingLoginPhone = null;
  await clearToken();
}

// ── Change PIN (authenticated) ─────────────────────────────────────────────────

export async function setPin(newPin: string): Promise<void> {
  const token = await getIdToken();
  await axios.post(
    `${Config.API_BASE_URL}/auth/set-pin`,
    { new_pin: newPin },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

// ── First-login PIN setup (unauthenticated) ────────────────────────────────────

/**
 * Called from the setup-pin screen when a user logs in for the first time
 * and no PIN has been set by the admin.
 * Sets the PIN on the backend and logs the user in, returning their profile.
 */
export async function setupPinFirstLogin(phone: string, newPin: string, confirmPin: string): Promise<User> {
  const { data } = await axios.post(`${Config.API_BASE_URL}/auth/setup-pin-first`, {
    phone,
    new_pin: newPin,
    confirm_pin: confirmPin,
  });
  await storeToken(data.token);
  return data.user as User;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getPendingPhone(): string | null {
  return pendingLoginPhone;
}
