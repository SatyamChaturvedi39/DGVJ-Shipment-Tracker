import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  Animated,
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

  const [phone, setPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'tos' | 'privacy' | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Pre-fill remembered phone & animate on mount
  useEffect(() => {
    getRememberedPhone().then(saved => {
      if (saved) setPhone(saved.replace('+91', ''));
    });

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true })
    ]).start();
  }, [fadeAnim, slideAnim]);

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
      const detail = e?.response?.data?.detail || e.message || 'Something went wrong. Try again.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleDevRole = (role: UserRole) => {
    setDevRole(role);
    router.replace('/');
  };

  const openModal = (type: 'tos' | 'privacy') => {
    setModalType(type);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        {/* ── Brand area ───────────────────────────────────────────── */}
        <View style={styles.brandArea}>
          <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
            <View style={styles.emblem}>
              <Text style={styles.emblemLetter}>D</Text>
            </View>
            <Text style={[styles.brandName, { fontSize: isSmall ? 32 : 40 }]}>
              DIGVIJAY
            </Text>
            <View style={styles.subtitleRow}>
              <View style={styles.line} />
              <Text style={styles.brandExpress}>EXPRESS</Text>
              <View style={styles.line} />
            </View>
          </Animated.View>
        </View>

        {/* ── White form card ──────────────────────────────────────── */}
        <Animated.View
          style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <ScrollView
            contentContainerStyle={styles.cardContent}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
          >
            <Text style={styles.cardTitle}>Welcome</Text>
            <Text style={styles.cardSubtitle}>Sign in to track and manage shipments</Text>

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
                placeholder="Enter mobile number"
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
              <Text style={styles.rememberLabel}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.continueBtn, (phone.length < 10 || loading) && styles.continueBtnDisabled]}
              onPress={handleContinue}
              disabled={phone.length < 10 || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.continueBtnText}>Continue</Text>}
            </TouchableOpacity>

            <View style={styles.legalContainer}>
              <Text style={styles.legalText}>
                By continuing, you agree to our{' '}
                <Text style={styles.legalLink} onPress={() => openModal('tos')}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.legalLink} onPress={() => openModal('privacy')}>Privacy Policy</Text>.
              </Text>
            </View>

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
        </Animated.View>
      </KeyboardAvoidingView>

      {/* ── Modals ────────────────────────────────────────────────── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalType === 'tos' ? 'Terms of Service' : 'Privacy Policy'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalText}>
                {modalType === 'tos'
                  ? "1. Acceptance of Terms\nBy accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.\n\n2. Service Usage\nThis app is strictly for authorized employees and customers of Digvijay Express. Unauthorized access, sharing of PINs, or reverse engineering is prohibited.\n\n3. Location Tracking\nDrivers agree to share their real-time location data while a shipment is in an active delivery phase (transit/out for delivery) to ensure transparency with customers.\n\n4. Liability\nDigvijay Express is not liable for indirect damages or delivery delays outside of our control.\n\n5. Modifications\nWe reserve the right to modify these terms at any time without prior notice."
                  : "1. Data Collection\nWe collect your phone number solely for authentication purposes. If you are an employee, we also collect real-time background location data while a shipment is active.\n\n2. Data Usage\nYour location data is strictly used to provide ETA and live-tracking to the specific customer expecting the delivery. Phone numbers are never sold or used for marketing.\n\n3. Data Protection\nWe implement standard cryptographic security measures (such as JWT tokens and bcrypt hashing for PINs) to maintain the safety of your personal information.\n\n4. Data Deletion\nYou can contact your admin to have your profile and historical data permanently deleted from our servers."}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: {
    flex: 1,
    backgroundColor: '#0F172A', // Deep slate for a premium dark feel
  },

  // ── Brand area
  brandArea: {
    flex: 0.45,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emblem: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: Colors.primary, // Deep red
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emblemLetter: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 56,
  },
  brandName: {
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    maxWidth: 50,
  },
  brandExpress: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 5,
  },

  // ── White form card
  card: {
    flex: 0.55,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  cardContent: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 32,
    flexGrow: 1,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 32,
  },

  // Auth error
  authErrorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 20,
  },
  authErrorText: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },

  // Phone input
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    marginBottom: 6,
  },
  phoneRowError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  flag: {
    fontSize: 18,
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  phoneInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  fieldError: {
    fontSize: 13,
    color: '#EF4444',
    marginBottom: 10,
    marginLeft: 4,
    fontWeight: '500',
  },

  // Remember Me
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 24,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '800',
    lineHeight: 16,
  },
  rememberLabel: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
  },

  // Continue button
  continueBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  continueBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  legalContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  legalText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  legalLink: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Dev section
  devSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  devDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    width: '100%',
  },
  devDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  devDividerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.5,
  },
  devLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  devBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  devRoleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  devRoleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '70%',
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748B',
  },
  modalBody: {
    padding: 24,
  },
  modalText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
    paddingBottom: 40,
  },
});
