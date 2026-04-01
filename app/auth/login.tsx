import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

export default function LoginScreen() {
  const { login, setDevRole } = useAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
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
      console.error('[Login] sendOTP error:', e?.message ?? e);
      setError(e.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleDevRole = (role: UserRole) => {
    setDevRole(role);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>D</Text>
          </View>
          <Text style={styles.appName}>Digvijay BLR</Text>
          <Text style={styles.tagline}>Shipment Tracking Made Simple</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            placeholder="9876543210"
            keyboardType="phone-pad"
            prefix="+91"
            maxLength={10}
            error={error}
          />
          <Button
            title="Send OTP"
            onPress={handleSendOTP}
            loading={loading}
            disabled={phone.length < 10}
          />
        </View>

        {__DEV__ && (
          <View style={styles.devSection}>
            <View style={styles.devBanner}>
              <Text style={styles.devBannerText}>DEV ONLY — Remove before release</Text>
            </View>
            <Text style={styles.devLabel}>Select Role to Skip OTP</Text>
            <View style={styles.devButtons}>
              <Button
                title="Admin"
                variant="secondary"
                onPress={() => handleDevRole('admin')}
                fullWidth={false}
                style={styles.devBtn}
              />
              <Button
                title="Employee"
                variant="secondary"
                onPress={() => handleDevRole('employee')}
                fullWidth={false}
                style={styles.devBtn}
              />
              <Button
                title="Customer"
                variant="secondary"
                onPress={() => handleDevRole('customer')}
                fullWidth={false}
                style={styles.devBtn}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
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
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.textOnPrimary,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  form: {
    gap: 8,
  },
  devSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  devBanner: {
    backgroundColor: '#C62828',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 14,
  },
  devBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  devButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  devBtn: {
    paddingHorizontal: 20,
  },
});
