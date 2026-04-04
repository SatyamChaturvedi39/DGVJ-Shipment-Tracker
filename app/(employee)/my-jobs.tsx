import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Config } from '@/constants/config';
import { getShipments } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { Shipment, ShipmentPhase } from '@/types';

// MANUAL TEST REQUIRED: My Jobs shows assigned shipments
//   In dev mode all shipments are shown (dev-mock-token = admin).
//   For production testing with a real employee token:
//   1. Log in as an employee (real phone OTP or Firebase test number)
//   2. "Active" tab must show only shipments where pickup_employee_id or
//      delivery_employee_id equals this employee's user ID
//   3. "Completed" tab shows only this employee's completed shipments
//   4. Pull-to-refresh reloads the list

// ─── Phase badge ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<ShipmentPhase, { label: string; bg: string; text: string }> = {
  pickup:            { label: 'Pickup',           bg: '#FFF8E1', text: '#F57F17' },
  transit:           { label: 'To Carrier',        bg: '#E3F2FD', text: '#1565C0' },
  handed_to_carrier: { label: 'With Carrier',      bg: '#F3E5F5', text: '#6A1B9A' },
  out_for_delivery:  { label: 'Out for Delivery',  bg: '#FFF8E1', text: '#F57F17' },
  completed:         { label: 'Completed',         bg: '#E8F5E9', text: '#2E7D32' },
};

function PhaseBadge({ phase }: { phase: ShipmentPhase }) {
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.pickup;
  return (
    <View style={[styles.phaseBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.phaseBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: 'pickup' | 'delivery' }) {
  const isPickup = role === 'pickup';
  return (
    <View style={[styles.roleBadge, isPickup ? styles.roleBadgePickup : styles.roleBadgeDelivery]}>
      <Text style={styles.roleBadgeText}>
        {isPickup ? 'PICKUP DRIVER' : 'DELIVERY DRIVER'}
      </Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEmployeeRole(
  shipment: Shipment,
  userId: string,
): 'pickup' | 'delivery' {
  if (shipment.delivery_employee_id === userId) return 'delivery';
  return 'pickup'; // default for dev mode where userId won't match
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  shipment,
  employeeRole,
}: {
  shipment: Shipment;
  employeeRole: 'pickup' | 'delivery';
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/(employee)/job-detail?id=${shipment.id}`)}
    >
      <View style={styles.cardTop}>
        <Text style={styles.trackingId}>{shipment.tracking_id}</Text>
        <PhaseBadge phase={shipment.current_phase} />
      </View>

      <Text style={styles.route}>
        {shipment.origin}  →  {shipment.destination}
      </Text>

      <View style={styles.cardBottom}>
        <RoleBadge role={employeeRole} />
        {shipment.eta_date ? (
          <Text style={styles.eta}>ETA {shipment.eta_date}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: 'active' | 'completed';
  onChange: (tab: 'active' | 'completed') => void;
}) {
  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, active === 'active' && styles.tabActive]}
        onPress={() => onChange('active')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, active === 'active' && styles.tabTextActive]}>
          Active
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, active === 'completed' && styles.tabActive]}
        onPress={() => onChange('completed')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, active === 'completed' && styles.tabTextActive]}>
          Completed
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function MyJobs() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getShipments();
      setShipments(data);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Unknown error';
      setError(`Could not load jobs: ${msg}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const userId = user?.id ?? '';

  // In dev mode, the backend returns all shipments (dev-mock-token → admin user).
  // We show all shipments so the employee can test job-detail navigation.
  const isAssigned = (s: Shipment) =>
    Config.DEV_MOCK_AUTH ||
    s.pickup_employee_id === userId ||
    s.delivery_employee_id === userId;

  const activeJobs = shipments.filter(s => {
    if (!isAssigned(s)) return false;
    if (s.current_phase === 'completed') return false;
    if (Config.DEV_MOCK_AUTH) return true;
    const role = getEmployeeRole(s, userId);
    // Pickup driver acts on pickup + transit phases
    if (role === 'pickup') return s.current_phase === 'pickup' || s.current_phase === 'transit';
    // Delivery driver acts on handed_to_carrier + out_for_delivery phases
    if (role === 'delivery') return s.current_phase === 'handed_to_carrier' || s.current_phase === 'out_for_delivery';
    return false;
  });

  const completedJobs = shipments.filter(
    s => s.current_phase === 'completed' && isAssigned(s),
  );

  const displayed = tab === 'active' ? activeJobs : completedJobs;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <TabBar active={tab} onChange={setTab} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <>
        <TabBar active={tab} onChange={setTab} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <View style={styles.container}>
      <TabBar active={tab} onChange={setTab} />

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {displayed.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{tab === 'active' ? '📋' : '✅'}</Text>
            <Text style={styles.emptyTitle}>
              {tab === 'active' ? 'No active jobs assigned to you' : 'No completed jobs'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === 'active'
                ? 'Your active pickup and delivery jobs will appear here.'
                : 'Jobs you have completed will appear here.'}
            </Text>
          </View>
        ) : (
          displayed.map(s => (
            <JobCard
              key={s.id}
              shipment={s}
              employeeRole={getEmployeeRole(s, userId)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
  },

  // List
  list: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },

  // Job card
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  trackingId: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  route: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginBottom: 12,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eta: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Phase badge
  phaseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  phaseBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Role badge
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgePickup: {
    backgroundColor: '#FFF3E0',
  },
  roleBadgeDelivery: {
    backgroundColor: '#E8F5E9',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.textPrimary,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
