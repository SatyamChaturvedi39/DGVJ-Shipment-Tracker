import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Config } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';
import { getRememberedPhone, saveRememberedPhone, clearRememberedPhone } from '@/services/auth';
import type { UserRole } from '@/types';

export default function LoginScreen() {
  const { login, setDevRole, authError, clearAuthError } = useAuth();
  const { width } = useWindowDimensions();
  const isSmall = width < 380;

  const [phone, setPhone]         = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Pre-fill remembered phone on mount
  useEffect(() => {
    getRememberedPhone().then(saved => {
      if (saved) setPhone(saved.replace('+91', ''));
    });
  }, []);

  const handleContinue = async () => {
    if (phone.length < 10) {
      setError('Enter a valid 10-digit phone number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (rememberMe) {
        await saveRememberedPhone(phone);
      } else {
        await clearRememberedPhone();
      }
      const status = await login(`+91${phone}`);
      router.push(status === 'first_login' ? '/auth/setup-pin' : '/auth/verify');
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevRole = (role: UserRole) => {
    setDevRole(role);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        {/* ── Brand area ───────────────────────────────────────────── */}
        <View style={styles.brandArea}>
          {/* Logo emblem */}
          <View style={styles.emblem}>
            <Text style={styles.emblemLetter}>D</Text>
          </View>

          {/* Wordmark */}
          <Text style={[styles.brandName, { fontSize: isSmall ? 30 : 36 }]}>
            DIGVIJAY
          </Text>
          <View style={styles.subtitleRow}>
            <View style={styles.line} />
            <Text style={styles.brandExpress}>EXPRESS</Text>
            <View style={styles.line} />
          </View>
          <View style={styles.blrBadge}>
            <Text style={styles.blrBadgeText}>✈  BANGALORE</Text>
          </View>
        </View>

        {/* ── White form card ──────────────────────────────────────── */}
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={false}
        >
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>Enter your registered phone number</Text>

          {/* Auth error banner */}
          {authError ? (
            <View style={styles.authErrorBanner}>
              <Text style={styles.authErrorText}>{authError}</Text>
            </View>
          ) : null}

          {/* Phone input */}
          <View style={[styles.phoneRow, error ? styles.phoneRowError : null]}>
            <View style={styles.prefix}>
              <Text style={styles.flag}>🇮🇳</Text>
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={t => {
                setPhone(t);
                if (error) setError('');
                if (authError) clearAuthError();
              }}
              placeholder="98765 43210"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
          </View>
          {error ? <Text style={styles.fieldError}>{error}</Text> : null}

          {/* Remember Me */}
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe(v => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.rememberLabel}>Remember my number</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.continueBtn, (phone.length < 10 || loading) && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={phone.length < 10 || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.continueBtnText}>Continue  →</Text>}
          </TouchableOpacity>

          {/* Dev-only role selector */}
          {Config.DEV_ROLE_SELECTOR && (
            <View style={styles.devSection}>
              <View style={styles.devDivider}>
                <View style={styles.devDividerLine} />
                <Text style={styles.devDividerText}>DEV ONLY</Text>
                <View style={styles.devDividerLine} />
              </View>
              <Text style={styles.devLabel}>Skip PIN — Select Role</Text>
              <View style={styles.devBtns}>
                {(['admin', 'employee', 'customer'] as UserRole[]).map(role => (
                  <TouchableOpacity
                    key={role}
                    style={styles.devRoleBtn}
                    onPress={() => handleDevRole(role)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.devRoleBtnText}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: {
    flex: 1,
    backgroundColor: Colors.primary,
  },

  // ── Brand area
  brandArea: {
    flex: 0.42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  emblem: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  emblemLetter: {
    fontSize: 44,
    fontWeight: '900',
    color: Colors.primary,
    lineHeight: 52,
  },
  brandName: {
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    maxWidth: 40,
  },
  brandExpress: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 4,
  },
  blrBadge: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  blrBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 2,
  },

  // ── White form card
  card: {
    flex: 0.58,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  cardContent: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 32,
    flexGrow: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },

  // Auth error
  authErrorBanner: {
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.error,
    marginBottom: 16,
  },
  authErrorText: {
    color: Colors.error,
    fontSize: 13,
    lineHeight: 18,
  },

  // Phone input
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    marginBottom: 4,
  },
  phoneRowError: {
    borderColor: Colors.error,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 16,
    backgroundColor: '#F0F0F0',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  flag: {
    fontSize: 16,
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  phoneInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: Colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  fieldError: {
    fontSize: 12,
    color: Colors.error,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Remember Me
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginBottom: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
    lineHeight: 14,
  },
  rememberLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Continue button
  continueBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  continueBtnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Dev section
  devSection: {
    marginTop: 28,
    alignItems: 'center',
  },
  devDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    width: '100%',
  },
  devDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  devDividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 12,
  },
  devBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  devRoleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  devRoleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
