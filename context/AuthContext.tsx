import React, { createContext, useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { sendOTP, verifyOTP as verifyOTPService, signOut as signOutService, getMockPhone } from '@/services/auth';
import { getMe } from '@/services/api';
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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getMe();
          setUser(profile);
        } catch (e: any) {
          if (e?.response?.status === 403) {
            // Phone not pre-registered or account deactivated — reject login
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
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (phone: string) => {
    setPendingPhone(phone);
    await sendOTP(phone);
  }, []);

  const verifyOTP = useCallback(async (code: string) => {
    await verifyOTPService(code);
    // onAuthStateChanged fires automatically after successful verification
    // and sets the user — no manual setUser needed here
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
