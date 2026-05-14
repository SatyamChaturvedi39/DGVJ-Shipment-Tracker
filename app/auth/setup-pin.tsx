import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { OTPInput } from '@/components/ui/OTPInput';
import { useAuth } from '@/hooks/useAuth';
import { getPendingPhone } from '@/services/auth';

const PIN_LENGTH = 4;

export default function SetupPinScreen() {
  const { setupFirstPin } = useAuth();
  const phone = getPendingPhone() ?? '';

  const [step, setStep] = useState<'new' | 'confirm'>('new');
  const [newPin, setNewPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const autoSubmittedRef            = useRef(false);

  // Step 1 — when new PIN is fully entered, advance to confirm step
  useEffect(() => {
    if (step === 'new' && newPin.length === PIN_LENGTH) {
      setStep('confirm');
    }
  }, [newPin, step]);

  // Step 2 — when confirm PIN is fully entered, submit
  useEffect(() => {
    if (step === 'confirm' && confirmPin.length === PIN_LENGTH && !loading && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleSubmit(confirmPin);
    }
    if (confirmPin.length < PIN_LENGTH) {
      autoSubmittedRef.current = false;
    }
  }, [confirmPin, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (confirmedPin: string) => {
    if (newPin !== confirmedPin) {
      setError('PINs do not match. Start over.');
      setNewPin('');
      setConfirmPin('');
      setStep('new');
      autoSubmittedRef.current = false;
      return;
    }
    setError('');
    setLoading(true);
    try {
      await setupFirstPin(phone, newPin, confirmedPin);
      router.replace('/');
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Something went wrong. Try again.';
      setError(msg);
      setNewPin('');
      setConfirmPin('');
      setStep('new');
      autoSubmittedRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setNewPin('');
    setConfirmPin('');
    setError('');
    if (step === 'confirm') {
      setStep('new');
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity onPress={goBack} style={styles.backBtn}>
        <Text style={styles.backText}><Ionicons name="arrow-back" size={18} color={Colors.primary} /> Back</Text>
      </TouchableOpacity>

      <View style={styles.container}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🔐</Text>
        </View>

        <Text style={styles.title}>Set Your PIN</Text>
        <Text style={styles.subtitle}>
          Welcome! Create a 4-digit PIN to secure your account.
          {'\n'}You will use this every time you log in.
        </Text>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={[styles.stepLine, step === 'confirm' && styles.stepLineActive]} />
          <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
        </View>
        <Text style={styles.stepLabel}>
          {step === 'new' ? 'Step 1 of 2 — Choose a PIN' : 'Step 2 of 2 — Confirm your PIN'}
        </Text>

        <View style={styles.otpWrap}>
          {step === 'new'
            ? <OTPInput value={newPin} onChange={setNewPin} length={PIN_LENGTH} />
            : <OTPInput value={confirmPin} onChange={setConfirmPin} length={PIN_LENGTH} />
          }
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Setting up your PIN…</Text>
          </View>
        )}

        <Text style={styles.hint}>
          Keep your PIN private. If you forget it,{'\n'}contact your Digvijay Express administrator.
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
    paddingTop: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#CE93D8',
  },
  iconText:  { fontSize: 26 },
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
    marginBottom: 28,
    paddingHorizontal: 8,
  },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: Colors.primary,
  },
  stepLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 28,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
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
