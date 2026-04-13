import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Config } from '@/constants/config';
import { OTPInput } from '@/components/ui/OTPInput';
import { useAuth } from '@/hooks/useAuth';

const PIN_LENGTH = 4;

export default function VerifyScreen() {
  const { verifyOTP } = useAuth();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const autoSubmittedRef = useRef(false);

  // Auto-submit when all 4 digits are entered
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !loading && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleVerify(pin);
    }
    if (pin.length < PIN_LENGTH) {
      autoSubmittedRef.current = false;
    }
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async (pinToVerify: string) => {
    setError('');
    setLoading(true);
    try {
      await verifyOTP(pinToVerify);
      router.replace('/');
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? '';
      // Backend signals no PIN was ever set — redirect to first-time setup
      if (detail === 'FIRST_LOGIN') {
        router.replace('/auth/setup-pin');
        return;
      }
      setError(detail || 'Incorrect PIN. Please try again.');
      setPin('');
      autoSubmittedRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Back */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>←  Back</Text>
      </TouchableOpacity>

      <View style={styles.container}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🔒</Text>
        </View>

        <Text style={styles.title}>Enter PIN</Text>
        <Text style={styles.subtitle}>
          Enter your 4-digit PIN to sign in.
          {Config.DEV_MOCK_AUTH ? '\n(Dev: any 4-digit PIN works)' : ''}
        </Text>

        <View style={styles.otpWrap}>
          <OTPInput value={pin} onChange={setPin} length={PIN_LENGTH} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Loading indicator while verifying */}
        {loading && (
          <View style={styles.verifyingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.verifyingText}>Signing in…</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Forgot PIN?',
              'Contact your Digvijay Express administrator to reset your PIN. They can set a new one from the Team screen.',
              [{ text: 'OK' }]
            )
          }
          activeOpacity={0.7}
          style={styles.forgotBtn}
        >
          <Text style={styles.forgotText}>Forgot PIN?</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Your PIN was set by your administrator.{'\n'}Contact Digvijay Express if you don't have one.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#FFCDD2',
  },
  iconText: {
    fontSize: 26,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
    paddingHorizontal: 8,
  },
  otpWrap: {
    width: '100%',
    marginBottom: 20,
  },
  error: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  verifyingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  forgotBtn: {
    marginTop: 8,
    paddingVertical: 8,
  },
  forgotText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  hint: {
    marginTop: 16,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
