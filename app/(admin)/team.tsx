import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getAllUsers, createUser, updateUser, deleteUser } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { User, UserRole } from '@/types';

// ─── Avatar color ────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#C62828', '#1565C0', '#2E7D32', '#6A1B9A', '#E65100', '#00838F'];

function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const style =
    role === 'employee'
      ? { bg: '#E3F2FD', text: '#1565C0' }
      : { bg: '#E8F5E9', text: '#2E7D32' };
  return (
    <View style={[badgeStyles.badge, { backgroundColor: style.bg }]}>
      <Text style={[badgeStyles.label, { color: style.text }]}>
        {role === 'employee' ? 'Employee' : 'Customer'}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  label: { fontSize: 11, fontWeight: '700' },
});

function UserRow({ user, onPress }: { user: User; onPress: (u: User) => void }) {
  const avatarColor = getAvatarColor(user.name ?? user.phone);
  return (
    <TouchableOpacity
      style={[styles.row, !user.is_active && styles.rowInactive]}
      onPress={() => onPress(user)}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>
            {(user.name ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>{user.name ?? '—'}</Text>
          <Text style={styles.rowPhone}>{user.phone}</Text>
          {user.company_name ? (
            <Text style={styles.rowCompany}>{user.company_name}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        <RoleBadge role={user.role} />
        <View style={[styles.activeDot, { backgroundColor: user.is_active ? Colors.success : Colors.textMuted }]} />
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

interface AddModalState {
  visible: boolean;
  role: 'employee' | 'customer';
  name: string;
  phone: string;
  company: string;
  nameError: string;
  phoneError: string;
  apiError: string;
  submitting: boolean;
}

interface ActionSheetState {
  visible: boolean;
  user: User | null;
  editing: boolean;
  editName: string;
  editCompany: string;
  submitting: boolean;
}

const EMPTY_ADD: AddModalState = {
  visible: false,
  role: 'employee',
  name: '',
  phone: '',
  company: '',
  nameError: '',
  phoneError: '',
  apiError: '',
  submitting: false,
};

const EMPTY_ACTION: ActionSheetState = {
  visible: false,
  user: null,
  editing: false,
  editName: '',
  editCompany: '',
  submitting: false,
};

export default function TeamScreen() {
  const { logout } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'employees' | 'customers'>('employees');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState<AddModalState>(EMPTY_ADD);
  const [actionSheet, setActionSheet] = useState<ActionSheetState>(EMPTY_ACTION);

  const loadUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const all = await getAllUsers();
      setEmployees(all.filter((u) => u.role === 'employee'));
      setCustomers(all.filter((u) => u.role === 'customer'));
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUsers(true);
  }, [loadUsers]);

  // ── Add modal ──────────────────────────────────────────────────────────────

  const openAdd = (role: 'employee' | 'customer') => {
    setAddModal({ ...EMPTY_ADD, visible: true, role });
  };

  const submitAdd = async () => {
    const name = addModal.name.trim();
    const phone = addModal.phone.trim();
    let nameError = '';
    let phoneError = '';

    if (!name) nameError = 'Name is required';
    if (!/^\d{10}$/.test(phone)) phoneError = 'Enter a valid 10-digit number';

    if (nameError || phoneError) {
      setAddModal((s) => ({ ...s, nameError, phoneError }));
      return;
    }

    setAddModal((s) => ({ ...s, submitting: true, apiError: '' }));
    try {
      await createUser({
        name,
        phone: `+91${phone}`,
        role: addModal.role,
        company_name: addModal.company.trim() || undefined,
      });
      setAddModal(EMPTY_ADD);
      loadUsers(true);
    } catch (e: any) {
      const detail: string = e?.response?.data?.detail ?? '';
      const apiError =
        e?.response?.status === 409
          ? 'This phone number is already registered'
          : detail || 'Failed to add user. Try again.';
      setAddModal((s) => ({ ...s, submitting: false, apiError }));
    }
  };

  // ── Action sheet ───────────────────────────────────────────────────────────

  const openAction = (u: User) => {
    setActionSheet({
      visible: true,
      user: u,
      editing: false,
      editName: u.name ?? '',
      editCompany: u.company_name ?? '',
      submitting: false,
    });
  };

  const closeAction = () => setActionSheet(EMPTY_ACTION);

  const handleToggleActive = async () => {
    if (!actionSheet.user) return;
    const u = actionSheet.user;
    setActionSheet((s) => ({ ...s, submitting: true }));
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      closeAction();
      loadUsers(true);
    } catch {
      setActionSheet((s) => ({ ...s, submitting: false }));
      Alert.alert('Error', 'Could not update user. Try again.');
    }
  };

  const handleDelete = () => {
    if (!actionSheet.user) return;
    const u = actionSheet.user;
    Alert.alert(
      'Delete User',
      `Delete ${u.name ?? u.phone}? This cannot be undone. They will lose access to all shipments immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(u.id);
              closeAction();
              if (u.role === 'employee') {
                setEmployees(prev => prev.filter(e => e.id !== u.id));
              } else {
                setCustomers(prev => prev.filter(c => c.id !== u.id));
              }
            } catch {
              Alert.alert('Error', 'Could not delete user. Try again.');
            }
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!actionSheet.user) return;
    const u = actionSheet.user;
    const name = actionSheet.editName.trim();
    if (!name) return;
    setActionSheet((s) => ({ ...s, submitting: true }));
    try {
      await updateUser(u.id, {
        name,
        company_name: actionSheet.editCompany.trim() || undefined,
      });
      closeAction();
      loadUsers(true);
    } catch {
      setActionSheet((s) => ({ ...s, submitting: false }));
      Alert.alert('Error', 'Could not save changes. Try again.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const listData = activeTab === 'employees' ? employees : customers;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Team</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.addBtn} onPress={() => openAdd('employee')}>
            <Text style={styles.addBtnText}>+ Employee</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, styles.addBtnCustomer]} onPress={() => openAdd('customer')}>
            <Text style={[styles.addBtnText, styles.addBtnCustomerText]}>+ Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ])}
          >
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'employees' && styles.tabActive]}
          onPress={() => setActiveTab('employees')}
        >
          <Text style={[styles.tabLabel, activeTab === 'employees' && styles.tabLabelActive]}>
            Employees ({employees.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'customers' && styles.tabActive]}
          onPress={() => setActiveTab('customers')}
        >
          <Text style={[styles.tabLabel, activeTab === 'customers' && styles.tabLabelActive]}>
            Customers ({customers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <UserRow user={item} onPress={openAction} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          contentContainerStyle={listData.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {activeTab === 'employees' ? 'No employees yet' : 'No customers yet'}
            </Text>
          }
        />
      )}

      {/* ── Add Modal ──────────────────────────────────────────────────────── */}
      <Modal
        visible={addModal.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModal(EMPTY_ADD)}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setAddModal(EMPTY_ADD)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrapper}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>
                Add {addModal.role === 'employee' ? 'Employee' : 'Customer'}
              </Text>

              {addModal.apiError ? (
                <View style={styles.apiErrorBox}>
                  <Text style={styles.apiErrorText}>{addModal.apiError}</Text>
                </View>
              ) : null}

              <Input
                label="Full Name"
                value={addModal.name}
                onChangeText={(t) => setAddModal((s) => ({ ...s, name: t, nameError: '' }))}
                placeholder="e.g. Rajesh Kumar"
                error={addModal.nameError}
              />
              <Input
                label="Phone Number"
                value={addModal.phone}
                onChangeText={(t) => setAddModal((s) => ({ ...s, phone: t, phoneError: '' }))}
                placeholder="9876543210"
                keyboardType="phone-pad"
                maxLength={10}
                prefix="+91"
                error={addModal.phoneError}
              />
              {addModal.role === 'customer' && (
                <Input
                  label="Company Name (optional)"
                  value={addModal.company}
                  onChangeText={(t) => setAddModal((s) => ({ ...s, company: t }))}
                  placeholder="e.g. ABC Traders"
                />
              )}

              <View style={styles.sheetActions}>
                <Button
                  title={`Add ${addModal.role === 'employee' ? 'Employee' : 'Customer'}`}
                  onPress={submitAdd}
                  loading={addModal.submitting}
                />
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setAddModal(EMPTY_ADD)}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Action Sheet ───────────────────────────────────────────────────── */}
      <Modal
        visible={actionSheet.visible}
        animationType="slide"
        transparent
        onRequestClose={closeAction}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeAction} />
        <View style={styles.sheetWrapper}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {actionSheet.user && (
              <>
                <View style={styles.actionHeader}>
                  <Text style={styles.actionName}>{actionSheet.user.name ?? actionSheet.user.phone}</Text>
                  <RoleBadge role={actionSheet.user.role} />
                </View>

                {!actionSheet.editing ? (
                  <View style={styles.actionButtons}>
                    <Button
                      title="Edit Details"
                      variant="outline"
                      onPress={() => setActionSheet((s) => ({ ...s, editing: true }))}
                    />
                    <Button
                      title={actionSheet.user.is_active ? 'Deactivate' : 'Reactivate'}
                      variant={actionSheet.user.is_active ? 'outline' : 'secondary'}
                      onPress={handleToggleActive}
                      loading={actionSheet.submitting}
                    />
                    <Button
                      title="Delete User"
                      variant="danger"
                      onPress={handleDelete}
                    />
                  </View>
                ) : (
                  <View style={styles.actionButtons}>
                    <Input
                      label="Full Name"
                      value={actionSheet.editName}
                      onChangeText={(t) => setActionSheet((s) => ({ ...s, editName: t }))}
                      placeholder="Full name"
                    />
                    {actionSheet.user.role === 'customer' && (
                      <Input
                        label="Company Name (optional)"
                        value={actionSheet.editCompany}
                        onChangeText={(t) => setActionSheet((s) => ({ ...s, editCompany: t }))}
                        placeholder="Company name"
                      />
                    )}
                    <Button
                      title="Save Changes"
                      onPress={handleSaveEdit}
                      loading={actionSheet.submitting}
                    />
                    <Button
                      title="Cancel"
                      variant="outline"
                      onPress={() => setActionSheet((s) => ({ ...s, editing: false }))}
                    />
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.darkHeader,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  addBtnCustomer: {
    backgroundColor: '#2E7D32',
  },
  addBtnCustomerText: {
    color: '#FFFFFF',
  },
  signOutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8,
  },
  signOutBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.primary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  row: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rowInactive: {
    opacity: 0.6,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rowPhone: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  rowCompany: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  apiErrorBox: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  apiErrorText: {
    color: Colors.error,
    fontSize: 14,
  },
  sheetActions: {
    gap: 8,
    marginTop: 8,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  actionName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actionButtons: {
    gap: 10,
  },
});
