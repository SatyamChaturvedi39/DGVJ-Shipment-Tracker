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
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { updateMe } from '@/services/api';
import { setPin } from '@/services/auth';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';

// ─── Change PIN Modal ─────────────────────────────────────────────────────────

function ChangePinModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!/^\d{4}$/.test(newPin)) {
      setError('New PIN must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await setPin(newPin);
      Alert.alert('PIN Changed', 'Your PIN has been updated successfully.');
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to change PIN. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <TouchableOpacity style={pinStyles.backdrop} activeOpacity={1} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={pinStyles.wrapper}>
        <View style={pinStyles.sheet}>
          <View style={pinStyles.handle} />
          <Text style={pinStyles.title}>Change PIN</Text>

          {error ? (
            <View style={pinStyles.errorBox}>
              <Text style={pinStyles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="New PIN (4 digits)"
            value={newPin}
            onChangeText={(t) => { setNewPin(t.replace(/[^0-9]/g, '').slice(0, 4)); setError(''); }}
            placeholder="Enter new PIN"
            keyboardType="number-pad"
            maxLength={4}
          />
          <View style={{ height: 12 }} />
          <Input
            label="Confirm New PIN"
            value={confirmPin}
            onChangeText={(t) => { setConfirmPin(t.replace(/[^0-9]/g, '').slice(0, 4)); setError(''); }}
            placeholder="Re-enter new PIN"
            keyboardType="number-pad"
            maxLength={4}
          />
          <View style={{ height: 20 }} />

          <TouchableOpacity
            style={[pinStyles.saveBtn, saving && pinStyles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={pinStyles.saveBtnText}>Save PIN</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={pinStyles.cancelBtn} onPress={handleClose}>
            <Text style={pinStyles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const pinStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  wrapper: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.error,
    marginBottom: 12,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});

// ─── Main profile screen ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const barPaddingBottom = Math.max(insets.bottom, 16);

  const [name, setName] = useState(user?.name ?? '');
  const [companyName, setCompanyName] = useState(user?.company_name ?? '');
  const [saving, setSaving] = useState(false);
  const [showChangePIN, setShowChangePIN] = useState(false);

  const hasChanges =
    name.trim() !== (user?.name ?? '') ||
    companyName.trim() !== (user?.company_name ?? '');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateMe({ name: name.trim(), company_name: companyName.trim() || undefined });
      Alert.alert('Saved', 'Your profile has been updated.');
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

  const initials = (user?.name ?? 'C').charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: 80 + barPaddingBottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{initials}</Text>
          </View>
          <Text style={styles.avatarName}>{user?.name ?? 'Customer'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>CUSTOMER</Text>
          </View>
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
          <Input
            label="Company Name"
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Your company (optional)"
          />
          <View style={{ height: 16 }} />

          {/* Phone — read only */}
          <Text style={styles.fieldLabel}>Phone Number</Text>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyText}>{user?.phone ?? '—'}</Text>
            <Text style={styles.readonlyHint}>Cannot be changed</Text>
          </View>
        </View>

        {/* Change PIN */}
        <TouchableOpacity style={styles.changePinBtn} onPress={() => setShowChangePIN(true)} activeOpacity={0.7}>
          <Text style={styles.changePinIcon}>🔒</Text>
          <Text style={styles.changePinText}>Change PIN</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sticky save bar — only visible when there are unsaved changes */}
      {hasChanges && (
        <View style={[styles.stickyBar, { paddingBottom: barPaddingBottom }]}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Change PIN modal */}
      <ChangePinModal visible={showChangePIN} onClose={() => setShowChangePIN(false)} />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    padding: 20,
    paddingBottom: 24,
  },

  // Avatar
  avatarWrapper: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: '#FDECEA',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: Colors.primary,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // Read-only phone field
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  readonlyField: {
    backgroundColor: '#F8F9FA',
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

  // Change PIN button
  changePinBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  changePinIcon: {
    fontSize: 18,
  },
  changePinText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textMuted,
  },

  // Sign out
  signOutBtn: {
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

  // Sticky save bar
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
