import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Config } from '@/constants/config';
import { Button } from '@/components/ui/Button';
import { OTPInput } from '@/components/ui/OTPInput';
import { useAuth } from '@/hooks/useAuth';

export default function VerifyScreen() {
  const { verifyOTP, setDevRole } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerify = async () => {
    if (code.length < 6) return;
    setError('');
    setLoading(true);
    try {
      await verifyOTP(code);
      if (Config.DEV_MOCK_AUTH) {
        // In dev mode, go back to login for role selection
        // or auto-select admin for convenience
        setDevRole('admin');
      }
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setCountdown(30);
    // In production, call sendOTP again
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to your phone
          </Text>
          {Config.DEV_MOCK_AUTH && (
            <Text style={styles.devHint}>Dev mode: use 123456</Text>
          )}
        </View>

        <View style={styles.otpContainer}>
          <OTPInput value={code} onChange={setCode} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Verify"
          onPress={handleVerify}
          loading={loading}
          disabled={code.length < 6}
        />

        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.resendText}>
              Resend OTP in {countdown}s
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendLink}>Resend OTP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backBtn: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: '600',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  devHint: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '600',
    marginTop: 8,
  },
  otpContainer: {
    marginBottom: 32,
  },
  error: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 24,
  },
  resendText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  resendLink: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '600',
  },
});
