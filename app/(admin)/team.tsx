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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getAllUsers, createUser, updateUser, deleteUser } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { User, UserRole } from '@/types';

function RoleBadge({ role }: { role: UserRole }) {
  const style =
    role === 'employee'
      ? { bg: '#e0f2fe', text: '#0369a1', icon: 'bus-outline' }
      : { bg: '#f0fdf4', text: '#15803d', icon: 'business-outline' };
  
  return (
    <View style={[badgeStyles.badge, { backgroundColor: style.bg }]}>
      <Ionicons name={style.icon as any} size={10} color={style.text} style={{ marginRight: 4 }} />
      <Text style={[badgeStyles.label, { color: style.text }]}>
        {role === 'employee' ? 'Driver' : 'Client'}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  label: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});

function UserRow({ user, onPress }: { user: User; onPress: (u: User) => void }) {
  const initials = (user.name ?? '?')[0].toUpperCase();
  
  return (
    <TouchableOpacity
      style={[styles.card, !user.is_active && styles.cardInactive]}
      onPress={() => onPress(user)}
      activeOpacity={0.7}
    >
      <View style={styles.cardMain}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {user.is_active && <View style={styles.onlineIndicator} />}
        </View>
        
        <View style={styles.cardInfo}>
          <Text style={styles.userName} numberOfLines={1}>{user.name ?? 'Unnamed User'}</Text>
          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.userPhone}>{user.phone}</Text>
          </View>
          {user.company_name && (
            <View style={styles.companyRow}>
              <Ionicons name="business-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.userCompany} numberOfLines={1}>{user.company_name}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardRight}>
          <RoleBadge role={user.role} />
          <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

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
      // Error handled by state
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

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const submitAdd = async () => {
    const name = addModal.name.trim();
    const phone = addModal.phone.trim();
    const pin = addModal.pin.trim();
    let nameError = '';
    let phoneError = '';
    let pinError = '';

    if (!name) nameError = 'Name is required';
    if (!/^\d{10}$/.test(phone)) phoneError = '10-digit number required';
    if (pin && (!/^\d{4}$/.test(pin))) pinError = 'PIN must be 4 digits';

    if (nameError || phoneError || pinError) {
      setAddModal((s) => ({ ...s, nameError, phoneError, pinError }));
      return;
    }

    setAddModal((s) => ({ ...s, submitting: true, apiError: '' }));
    try {
      await createUser({
        name,
        phone: `+91${phone}`,
        role: addModal.role,
        company_name: addModal.company.trim() || undefined,
        pin: pin || undefined,
      });
      setAddModal(EMPTY_ADD);
      loadUsers(true);
    } catch (e: any) {
      const detail: string = e?.response?.data?.detail ?? '';
      const apiError = e?.response?.status === 409 ? 'Number already registered' : detail || 'Failed to add user';
      setAddModal((s) => ({ ...s, submitting: false, apiError }));
    }
  };

  const listData = activeTab === 'employees' ? employees : customers;

  return (
    <View style={styles.flex}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'employees' && styles.tabActive]}
            onPress={() => setActiveTab('employees')}
          >
            <Ionicons name="bus" size={16} color={activeTab === 'employees' ? '#FFF' : '#64748b'} />
            <Text style={[styles.tabLabel, activeTab === 'employees' && styles.tabLabelActive]}>Drivers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'customers' && styles.tabActive]}
            onPress={() => setActiveTab('customers')}
          >
            <Ionicons name="business" size={16} color={activeTab === 'customers' ? '#FFF' : '#64748b'} />
            <Text style={[styles.tabLabel, activeTab === 'customers' && styles.tabLabelActive]}>Clients</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => setAddModal({ ...EMPTY_ADD, visible: true, role: activeTab === 'employees' ? 'employee' : 'customer' })}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <UserRow user={item} onPress={(u) => setActionSheet({ ...EMPTY_ACTION, visible: true, user: u, editName: u.name ?? '', editCompany: u.company_name ?? '' })} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={60} color="#e2e8f0" />
              <Text style={styles.emptyText}>No personnel found in this category</Text>
            </View>
          }
        />
      )}

      {/* Add Modal */}
      <Modal visible={addModal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.flex} onPress={() => setAddModal(EMPTY_ADD)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Add New {addModal.role === 'employee' ? 'Driver' : 'Client'}</Text>
              
              {addModal.apiError ? <Text style={styles.errorText}>{addModal.apiError}</Text> : null}

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
              <Input
                label="Initial PIN (Optional)"
                value={addModal.pin}
                onChangeText={(t) => setAddModal((s) => ({ ...s, pin: t.replace(/[^0-9]/g, '').slice(0, 4), pinError: '' }))}
                placeholder="User can set on first login"
                keyboardType="number-pad"
                maxLength={4}
                error={addModal.pinError}
              />
              {addModal.role === 'customer' && (
                <Input
                  label="Company Name"
                  value={addModal.company}
                  onChangeText={(t) => setAddModal((s) => ({ ...s, company: t }))}
                  placeholder="e.g. ABC Logistics"
                />
              )}

              <View style={styles.modalActions}>
                <Button title="Save Personnel" onPress={submitAdd} loading={addModal.submitting} />
                <TouchableOpacity onPress={() => setAddModal(EMPTY_ADD)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Action Sheet */}
      <Modal visible={actionSheet.visible} animationType="fade" transparent>
        <View style={styles.actionOverlay}>
          <TouchableOpacity style={styles.flex} onPress={() => setActionSheet(EMPTY_ACTION)} />
          <View style={styles.actionContent}>
            <View style={styles.modalHandle} />
            {actionSheet.user && (
              <View style={styles.actionBody}>
                <View style={styles.actionUserHeader}>
                  <View style={styles.avatarCircleSmall}>
                    <Text style={styles.avatarTextSmall}>{(actionSheet.user.name ?? '?')[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.actionUserName}>{actionSheet.user.name}</Text>
                    <Text style={styles.actionUserPhone}>{actionSheet.user.phone}</Text>
                  </View>
                </View>

                <View style={styles.actionButtonsGrid}>
                  <ActionBtn icon="create-outline" label="Edit" onPress={() => setActionSheet(s => ({ ...s, editing: true }))} />
                  <ActionBtn icon="key-outline" label="Reset PIN" onPress={() => setActionSheet(s => ({ ...s, resettingPin: true }))} />
                  <ActionBtn 
                    icon={actionSheet.user.is_active ? "close-circle-outline" : "checkmark-circle-outline"} 
                    label={actionSheet.user.is_active ? "Suspend" : "Activate"} 
                    onPress={async () => {
                      try {
                        await updateUser(actionSheet.user!.id, { is_active: !actionSheet.user!.is_active });
                        loadUsers(true);
                        setActionSheet(EMPTY_ACTION);
                      } catch { Alert.alert('Error', 'Update failed'); }
                    }} 
                  />
                  <ActionBtn icon="trash-outline" label="Delete" color="#ef4444" onPress={async () => {
                    Alert.alert('Delete User', 'Are you sure?', [
                      { text: 'Cancel' },
                      { text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                          await deleteUser(actionSheet.user!.id);
                          loadUsers(true);
                          setActionSheet(EMPTY_ACTION);
                        } catch { Alert.alert('Error', 'Delete failed'); }
                      }}
                    ]);
                  }} />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, color = Colors.slate }: any) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <View style={[styles.actionIconWrap, { borderColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.actionBtnLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  header: {
    backgroundColor: Colors.slateDark,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '600' },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  logoutText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  tabContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  tabBar: { flex: 1, flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  tabActive: { backgroundColor: Colors.slate, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabLabelActive: { color: '#FFF' },
  fab: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.slate, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowOpacity: 0.2, shadowRadius: 5 },

  listContent: { padding: 16, paddingTop: 0, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardInactive: { opacity: 0.5, backgroundColor: '#f8fafc' },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  avatarContainer: { position: 'relative' },
  avatarCircle: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  avatarText: { fontSize: 18, fontWeight: '800', color: Colors.slate },
  onlineIndicator: { position: 'absolute', right: -2, bottom: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#FFF' },
  cardInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userPhone: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  userCompany: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  cardRight: { alignItems: 'flex-end', gap: 8 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 14, color: '#94a3b8', marginTop: 12, fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  modalScroll: { paddingHorizontal: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.slateDark, marginBottom: 24 },
  errorText: { color: '#ef4444', fontSize: 13, backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#fee2e2' },
  modalActions: { marginTop: 12, gap: 12 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 14, color: '#64748b', fontWeight: '600' },

  actionOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  actionContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  actionBody: { paddingHorizontal: 24 },
  actionUserHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  avatarCircleSmall: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  avatarTextSmall: { fontSize: 16, fontWeight: '800', color: Colors.slate },
  actionUserName: { fontSize: 17, fontWeight: '700', color: Colors.slateDark },
  actionUserPhone: { fontSize: 13, color: '#64748b' },
  actionButtonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionBtn: { width: '47%', backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  actionIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  actionBtnLabel: { fontSize: 12, fontWeight: '700' },
});

interface AddModalState {
  visible: boolean;
  role: 'employee' | 'customer';
  name: string;
  phone: string;
  company: string;
  pin: string;
  nameError: string;
  phoneError: string;
  pinError: string;
  apiError: string;
  submitting: boolean;
}

interface ActionSheetState {
  visible: boolean;
  user: User | null;
  editing: boolean;
  editName: string;
  editCompany: string;
  resettingPin: boolean;
  newPin: string;
  pinError: string;
  submitting: boolean;
}

const EMPTY_ADD: AddModalState = {
  visible: false, role: 'employee', name: '', phone: '', company: '', pin: '', nameError: '', phoneError: '', pinError: '', apiError: '', submitting: false,
};

const EMPTY_ACTION: ActionSheetState = {
  visible: false, user: null, editing: false, editName: '', editCompany: '', resettingPin: false, newPin: '', pinError: '', submitting: false,
};
