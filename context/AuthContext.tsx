import React, { createContext, useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';
import {
  sendOTP,
  verifyOTP as verifyOTPService,
  signOut as signOutService,
  getMockPhone,
  getIdToken,
  NATIVE_FIREBASE_AVAILABLE,
} from '@/services/auth';
import { getMe, verifyToken } from '@/services/api';
import { Config } from '@/constants/config';
import type { User, UserRole } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  clearAuthError: () => void;
  login: (phone: string) => Promise<void>;
  verifyOTP: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  setDevRole: (role: UserRole) => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  authError: null,
  clearAuthError: () => {},
  login: async () => {},
  verifyOTP: async () => {},
  logout: async () => {},
  setDevRole: () => {},
});

function createMockUser(phone: string, role: UserRole): User {
  return {
    id: 'dev-user-1',
    phone,
    name: role === 'admin' ? 'Admin User' : role === 'employee' ? 'Employee User' : 'Customer User',
    role,
    company_name: role === 'customer' ? 'Test Company' : null,
    firebase_uid: 'dev-uid-123',
    is_active: true,
    created_at: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  useEffect(() => {
    if (Config.DEV_MOCK_AUTH) {
      setIsLoading(false);
      return;
    }

    if (NATIVE_FIREBASE_AVAILABLE) {
      // EAS native build — @react-native-firebase handles persistence.
      // Check for an existing signed-in user using getIdToken(), which reads
      // from the native module directly. JS SDK's onAuthStateChanged is NOT
      // used here because it's a separate instance that native sign-in doesn't notify.
      getIdToken()
        .then(async (token) => {
          if (token) {
            try {
              const profile = await verifyToken(token);
              setUser(profile);
            } catch (e: any) {
              if (e?.response?.status === 403) {
                await signOutService();
                setAuthError(
                  e?.response?.data?.detail ||
                  'Access denied. Contact Digvijay Express to get access.'
                );
              }
              setUser(null);
            }
          } else {
            setUser(null);
          }
          setIsLoading(false);
        })
        .catch(() => {
          setUser(null);
          setIsLoading(false);
        });
      return;
    }

    // Expo Go — Firebase JS SDK. onAuthStateChanged fires after AsyncStorage
    // restores the session, which is the correct hook for JS SDK session restoration.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          const profile = await verifyToken(token);
          setUser(profile);
        } catch (e: any) {
          if (e?.response?.status === 403) {
            await signOutService();
            setAuthError(
              e?.response?.data?.detail ||
              'Access denied. Contact Digvijay Express to get access.'
            );
          } else {
            await signOutService();
            setAuthError(
              'Server is starting up — this takes ~30s on first access. Please wait, then tap Send OTP to try again.'
            );
          }
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (phone: string) => {
    setPendingPhone(phone);
    await sendOTP(phone);
  }, []);

  const verifyOTP = useCallback(async (code: string) => {
    await verifyOTPService(code);

    if (Config.DEV_MOCK_AUTH) {
      setIsLoading(true);
      try {
        const profile = await getMe();
        setUser(profile);
      } catch (e: any) {
        if (e?.response?.status === 403) {
          await signOutService();
          setAuthError(
            e?.response?.data?.detail ||
            'Access denied. Contact Digvijay Express to get access.'
          );
        }
        setUser(null);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Real mode: get token immediately and call the backend.
    // We do NOT wait for JS SDK's onAuthStateChanged here because native
    // @react-native-firebase sign-in doesn't notify the JS SDK. For Expo Go
    // (JS SDK path), verifyOTPService already called confirmationResult.confirm()
    // which signs in the JS SDK user, so getIdToken() works there too.
    setIsLoading(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('No Firebase token after OTP verification');
      const profile = await verifyToken(token);
      setUser(profile);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        await signOutService();
        setAuthError(
          e?.response?.data?.detail ||
          'Your number is not registered. Contact Digvijay Express to get access.'
        );
      } else {
        await signOutService();
        setAuthError(
          'Server is starting up — please wait ~30s and try again.'
        );
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOutService();
    setUser(null);
    setPendingPhone(null);
  }, []);

  const setDevRole = useCallback((role: UserRole) => {
    if (!Config.DEV_MOCK_AUTH) return;
    const phone = pendingPhone || getMockPhone() || '+919999999999';
    setUser(createMockUser(phone, role));
  }, [pendingPhone]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        authError,
        clearAuthError,
        login,
        verifyOTP,
        logout,
        setDevRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
