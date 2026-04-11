import React, { useState } from 'react';
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
import type { UserRole } from '@/types';

export default function LoginScreen() {
  const { login, setDevRole, authError, clearAuthError } = useAuth();
  const { width } = useWindowDimensions();
  const brandFontSize = width < 380 ? 34 : 42;

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (phone.length < 10) {
      setError('Enter a valid 10-digit phone number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(`+91${phone}`);
      router.push('/auth/verify');
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
        {/* ── Red brand header ─────────────────────────────────────── */}
        <View style={styles.brandArea}>
          <View style={styles.wordmarkRow}>
            <Text style={[styles.brandMain, { fontSize: brandFontSize }]}>DIGVIJAY</Text>
            <View style={styles.blrChip}>
              <Text style={styles.blrChipText}>BLR</Text>
            </View>
          </View>
          <Text style={styles.brandSub}>EXPRESS</Text>
          <Text style={styles.tagline}>Bangalore Branch  ·  Shipment Tracking</Text>
        </View>

        {/* ── White body card ───────────────────────────────────────── */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={false}
        >
          {/* Auth error banner */}
          {authError ? (
            <View style={styles.authError}>
              <Text style={styles.authErrorText}>{authError}</Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>Phone Number</Text>
          <View style={[styles.phoneRow, error ? styles.phoneRowError : null]}>
            <View style={styles.prefix}>
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
              placeholder="9876543210"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
          </View>
          {error ? <Text style={styles.fieldError}>{error}</Text> : null}

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

          <Text style={styles.hint}>
            Enter your registered phone number to sign in.
          </Text>

          {/* Dev-only role selector */}
          {Config.DEV_ROLE_SELECTOR && (
            <View style={styles.devSection}>
              <View style={styles.devBanner}>
                <Text style={styles.devBannerText}>DEV ONLY</Text>
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

  // ── Brand area (red)
  brandArea: {
    flex: 0.38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  brandMain: {
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  blrChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  blrChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  brandSub: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 5,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.3,
  },

  // ── Body card (white)
  body: {
    flex: 0.62,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    flexGrow: 1,
  },

  // Auth error
  authError: {
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
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
    paddingHorizontal: 14,
    paddingVertical: 16,
    backgroundColor: '#EFEFEF',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  prefixText: {
    fontSize: 16,
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

  // Continue button
  continueBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Dev section
  devSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  devBanner: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 10,
  },
  devBannerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.5,
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
