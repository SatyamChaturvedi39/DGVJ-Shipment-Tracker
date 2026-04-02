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
  login: (phone: string) => Promise<void>;
  verifyOTP: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  setDevRole: (role: UserRole) => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
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
    created_at: new Date().toISOString(),
  };
}

function createUserFromFirebase(firebaseUser: { uid: string; phoneNumber: string | null }): User {
  // Phase 1 fallback — role will come from Supabase in Phase 2.
  // Defaults to 'customer' so any verified phone number can enter the app.
  return {
    id: firebaseUser.uid,
    phone: firebaseUser.phoneNumber ?? '',
    name: 'User',
    role: 'customer',
    company_name: null,
    firebase_uid: firebaseUser.uid,
    created_at: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  useEffect(() => {
    if (Config.DEV_MOCK_AUTH) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch role from backend (Phase 2 will have real Supabase data)
          const profile = await getMe();
          setUser(profile);
        } catch {
          // Backend not running — fall back to a basic user derived from Firebase
          setUser(createUserFromFirebase(firebaseUser));
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
