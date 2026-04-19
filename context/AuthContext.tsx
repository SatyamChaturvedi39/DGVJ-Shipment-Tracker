import React, { createContext, useCallback, useEffect, useState } from 'react';
import {
  loginWithPhone,
  loginWithPin,
  setupPinFirstLogin,
  signOut as signOutService,
  getPendingPhone,
  getStoredToken,
} from '@/services/auth';
import { getMe } from '@/services/api';
import { Config } from '@/constants/config';
import type { User, UserRole } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  clearAuthError: () => void;
  login: (phone: string) => Promise<'needs_pin' | 'first_login'>;
  verifyOTP: (pin: string) => Promise<void>;
  setupFirstPin: (phone: string, newPin: string, confirmPin: string) => Promise<void>;
  logout: () => Promise<void>;
  setDevRole: (role: UserRole) => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  authError: null,
  clearAuthError: () => {},
  login: async () => 'needs_pin' as const,
  verifyOTP: async () => {},
  setupFirstPin: async () => {},
  logout: async () => {},
  setDevRole: () => {},
  refreshUser: async () => {},
});

function createMockUser(phone: string, role: UserRole): User {
  return {
    id: 'dev-user-1',
    phone,
    name: role === 'admin' ? 'Admin User' : role === 'employee' ? 'Employee User' : 'Customer User',
    role,
    company_name: role === 'customer' ? 'Test Company' : null,
    firebase_uid: null,
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

  // ── Session restore on startup ───────────────────────────────────────────────
  useEffect(() => {
    if (Config.DEV_MOCK_AUTH) {
      // Dev mode — role selector handles auth; nothing to restore
      setIsLoading(false);
      return;
    }

    getStoredToken()
      .then(async (token) => {
        if (token) {
          try {
            const profile = await getMe();
            setUser(profile);
          } catch (e: any) {
            // Token invalid / expired / account deactivated
            await signOutService();
            if (e?.response?.status === 403) {
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
  }, []);

  // ── Login: phone screen ──────────────────────────────────────────────────────
  const login = useCallback(async (phone: string) => {
    setPendingPhone(phone);
    return await loginWithPhone(phone);
  }, []);

  // ── Verify: PIN screen ───────────────────────────────────────────────────────
  const verifyOTP = useCallback(async (pin: string) => {
    const phone = pendingPhone || getPendingPhone() || '';
    setIsLoading(true);
    try {
      const profile = await loginWithPin(phone, pin);
      setUser(profile);
    } catch (e: any) {
      setUser(null);
      setIsLoading(false);
      // Re-throw so verify.tsx can show the error in-place without navigating
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [pendingPhone]);

  // ── First-login PIN setup ────────────────────────────────────────────────────
  const setupFirstPin = useCallback(async (phone: string, newPin: string, confirmPin: string) => {
    setIsLoading(true);
    try {
      const profile = await setupPinFirstLogin(phone, newPin, confirmPin);
      setUser(profile);
    } catch (e: any) {
      setIsLoading(false);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await signOutService();
    setUser(null);
    setPendingPhone(null);
  }, []);

  // ── Refresh user profile (called after profile save) ────────────────────────
  const refreshUser = useCallback(async () => {
    if (Config.DEV_MOCK_AUTH) return;
    try {
      const profile = await getMe();
      setUser(profile);
    } catch { /* keep current user on error */ }
  }, []);

  // ── Dev role selector ────────────────────────────────────────────────────────
  const setDevRole = useCallback((role: UserRole) => {
    if (!Config.DEV_MOCK_AUTH) return;
    const phone = pendingPhone || getPendingPhone() || '+919999999999';
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
        setupFirstPin,
        logout,
        setDevRole,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
