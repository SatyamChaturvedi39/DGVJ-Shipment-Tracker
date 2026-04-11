import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Config } from '@/constants/config';
import { OTPInput } from '@/components/ui/OTPInput';
import { useAuth } from '@/hooks/useAuth';

export default function VerifyScreen() {
  const { verifyOTP } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (code.length === 6 && !loading && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleVerify(code);
    }
    if (code.length < 6) {
      autoSubmittedRef.current = false;
    }
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async (codeToVerify: string) => {
    setError('');
    setLoading(true);
    try {
      await verifyOTP(codeToVerify);
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Invalid OTP. Please try again.');
      setCode('');
      autoSubmittedRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setCountdown(30);
    setCode('');
    setError('');
    autoSubmittedRef.current = false;
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Back */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>←  Back</Text>
      </TouchableOpacity>

      <View style={styles.container}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>✉</Text>
        </View>

        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>
          A 6-digit code was sent to your phone.
          {Config.DEV_MOCK_AUTH ? ' (Dev: use 123456)' : ''}
        </Text>

        <View style={styles.otpWrap}>
          <OTPInput value={code} onChange={setCode} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Loading indicator shown below OTP boxes while verifying */}
        {loading && (
          <View style={styles.verifyingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.verifyingText}>Verifying…</Text>
          </View>
        )}

        {/* Resend */}
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.resendTimer}>
              Resend code in  <Text style={styles.resendCount}>{countdown}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
              <Text style={styles.resendLink}>Resend OTP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Full-screen overlay while verifying (blocks interaction) */}
      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.overlayText}>Verifying…</Text>
        </View>
      )}
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
  resendRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  resendTimer: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  resendCount: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  resendLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
