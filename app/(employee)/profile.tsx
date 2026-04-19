import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { updateMe } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function EmployeeProfileScreen() {
  const { user, logout, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasChanges = name.trim() !== (user?.name ?? '');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateMe({ name: name.trim() });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Failed to save. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name ?? 'E').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.roleBadge}>EMPLOYEE</Text>
        </View>

        {/* Fields */}
        <View style={styles.card}>
          <Input
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
          />
          <View style={{ height: 16 }} />

          {/* Phone — read only */}
          <Text style={styles.fieldLabel}>Phone Number</Text>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyText}>{user?.phone ?? '—'}</Text>
            <Text style={styles.readonlyHint}>Cannot be changed</Text>
          </View>
        </View>

        {saved && (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>✓  Profile saved successfully</Text>
          </View>
        )}
        {hasChanges && !saved && (
          <Button
            title={saving ? 'Saving…' : 'Save Changes'}
            onPress={handleSave}
            disabled={saving}
            style={styles.saveBtn}
          />
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  avatarWrapper: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  roleBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: Colors.primary,
    backgroundColor: '#FDECEA',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  readonlyField: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  readonlyText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  readonlyHint: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  successBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  successBannerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2E7D32',
  },
  saveBtn: {
    marginBottom: 12,
  },
  signOutBtn: {
    marginTop: 24,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
});
