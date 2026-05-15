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
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Config } from '@/constants/config';
import { PHASE_CONFIG } from '@/constants/phases';
import { getShipments } from '@/services/api';
import { formatETA, formatFullDate } from '@/utils/formatDate';
import { useAuth } from '@/hooks/useAuth';
import type { Shipment, ShipmentPhase } from '@/types';

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: 'pickup' | 'delivery' }) {
  const isPickup = role === 'pickup';
  return (
    <View style={[styles.roleBadge, isPickup ? styles.roleBadgePickup : styles.roleBadgeDelivery]}>
      <Text style={[styles.roleBadgeText, { color: isPickup ? '#F57F17' : '#1565C0' }]}>
        {isPickup ? 'PICKUP' : 'DELIVERY'}
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
  return 'pickup';
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  shipment,
  employeeRole,
}: {
  shipment: Shipment;
  employeeRole: 'pickup' | 'delivery';
}) {
  const isCompleted = shipment.current_phase === 'completed';
  const cfg = PHASE_CONFIG[shipment.current_phase];

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/(employee)/job-detail?id=${shipment.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.trackingId}>{shipment.tracking_id}</Text>
        <View style={[styles.phaseBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.phaseBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.cityBox}>
          <Text style={styles.cityLabel}>From</Text>
          <Text style={styles.cityName}>{shipment.origin}</Text>
        </View>
        <View style={styles.routeArrow}>
          <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
        </View>
        <View style={[styles.cityBox, { alignItems: 'flex-end' }]}>
          <Text style={styles.cityLabel}>To</Text>
          <Text style={styles.cityName}>{shipment.destination}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <RoleBadge role={employeeRole} />
        {isCompleted ? (
          <Text style={styles.footerNote}>Done {formatFullDate(shipment.completed_at)}</Text>
        ) : shipment.eta_date ? (
          <Text style={styles.footerNote}>ETA {formatETA(shipment.eta_date, shipment.eta_time)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

function TabBar({
  active,
  activeCount,
  completedCount,
  onChange,
}: {
  active: 'active' | 'completed';
  activeCount: number;
  completedCount: number;
  onChange: (tab: 'active' | 'completed') => void;
}) {
  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, active === 'active' && styles.tabActive]}
          onPress={() => onChange('active')}
        >
          <Text style={[styles.tabText, active === 'active' && styles.tabTextActive]}>
            Active ({activeCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, active === 'completed' && styles.tabActive]}
          onPress={() => onChange('completed')}
        >
          <Text style={[styles.tabText, active === 'completed' && styles.tabTextActive]}>
            History ({completedCount})
          </Text>
        </TouchableOpacity>
      </View>
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
      setError('Could not load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(true);
      const interval = setInterval(() => load(true), 20000);
      return () => clearInterval(interval);
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const userId = user?.id ?? '';

  const isAssigned = (s: Shipment) =>
    Config.DEV_MOCK_AUTH ||
    s.pickup_employee_id === userId ||
    s.delivery_employee_id === userId;

  const activeJobs = shipments.filter(s => {
    if (!isAssigned(s)) return false;
    if (s.current_phase === 'completed') return false;
    if (Config.DEV_MOCK_AUTH) return true;
    const role = getEmployeeRole(s, userId);
    if (role === 'pickup') return s.current_phase === 'pickup' || s.current_phase === 'transit';
    return true; // delivery drivers see from handed_to_carrier onwards
  });

  const completedJobs = shipments.filter(
    s => s.current_phase === 'completed' && isAssigned(s),
  );

  const displayed = tab === 'active' ? activeJobs : completedJobs;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TabBar active={tab} activeCount={activeJobs.length} completedCount={completedJobs.length} onChange={setTab} />

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {displayed.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name={tab === 'active' ? 'briefcase-outline' : 'checkmark-done-outline'} size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>
              {tab === 'active' ? 'No active jobs' : 'No history yet'}
            </Text>
            <Text style={styles.emptySub}>
              {tab === 'active' ? 'Assigned tasks will appear here' : 'Completed tasks will be archived here'}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabContainer: {
    backgroundColor: Colors.background,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: { flex: 1, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: Colors.slate },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#FFF' },

  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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
    backgroundColor: '#FFF8E1',
  },
  roleBadgeDelivery: {
    backgroundColor: '#E3F2FD',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
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
