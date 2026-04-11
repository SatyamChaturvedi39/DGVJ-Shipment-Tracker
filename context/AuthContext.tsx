import React, { createContext, useCallback, useEffect, useState } from 'react';
import {
  loginWithPhone,
  loginWithPin,
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
  login: (phone: string) => Promise<void>;
  verifyOTP: (pin: string) => Promise<void>;
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
    await loginWithPhone(phone);
  }, []);

  // ── Verify: PIN screen ───────────────────────────────────────────────────────
  const verifyOTP = useCallback(async (pin: string) => {
    const phone = pendingPhone || getPendingPhone() || '';
    setIsLoading(true);
    try {
      const profile = await loginWithPin(phone, pin);
      setUser(profile);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail ?? e?.message ?? 'Login failed. Try again.';
      if (status === 403 || status === 401) {
        setAuthError(detail);
      } else {
        setAuthError(
          'Cannot reach server — check your connection and try again.'
        );
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [pendingPhone]);

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await signOutService();
    setUser(null);
    setPendingPhone(null);
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
        logout,
        setDevRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
