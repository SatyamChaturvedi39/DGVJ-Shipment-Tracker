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
import { getShipments } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { Shipment, ShipmentPhase } from '@/types';

// MANUAL TEST REQUIRED: Dashboard loads shipments from backend
//   1. Open app in dev mode as Admin
//   2. Dashboard should show the shipment list with correct stats (active / completed count)
//   3. Pull-to-refresh should reload the list without errors

// ─── Phase badge ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<ShipmentPhase, { label: string; bg: string; text: string }> = {
  pickup:            { label: 'Pickup',           bg: '#FFF8E1', text: '#F57F17' },
  transit:           { label: 'In Transit',       bg: '#E3F2FD', text: '#1565C0' },
  handed_to_carrier: { label: 'With Carrier',     bg: '#F3E5F5', text: '#6A1B9A' },
  out_for_delivery:  { label: 'Out for Delivery', bg: '#FFF8E1', text: '#F57F17' },
  completed:         { label: 'Completed',        bg: '#E8F5E9', text: '#2E7D32' },
};

function PhaseBadge({ phase }: { phase: ShipmentPhase }) {
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.pickup;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Stats card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Phase left-border color ─────────────────────────────────────────────────

const PHASE_BORDER: Record<ShipmentPhase, string> = {
  pickup:            '#F57F17',
  transit:           '#1565C0',
  handed_to_carrier: '#6A1B9A',
  out_for_delivery:  '#F57F17',
  completed:         '#2E7D32',
};

// ─── Shipment row card ───────────────────────────────────────────────────────

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const borderColor = PHASE_BORDER[shipment.current_phase] ?? Colors.border;
  return (
    <TouchableOpacity
      style={[styles.shipmentCard, { borderLeftColor: borderColor }]}
      activeOpacity={0.7}
      onPress={() => router.push(`/(admin)/shipment-detail?id=${shipment.id}`)}
    >
      <View style={styles.shipmentCardTop}>
        <Text style={styles.trackingId}>{shipment.tracking_id}</Text>
        <PhaseBadge phase={shipment.current_phase} />
      </View>

      <Text style={styles.route}>
        {shipment.origin}  →  {shipment.destination}
      </Text>

      <View style={styles.shipmentCardBottom}>
        <View style={styles.transportTag}>
          <Text style={styles.transportTagText}>
            {shipment.transport_mode === 'air' ? '✈' : '🚂'}  {shipment.transport_number}
          </Text>
        </View>
        {shipment.eta_date ? (
          <Text style={styles.eta}>ETA {shipment.eta_date}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getShipments();
      setShipments(data);
    } catch {
      setError('Could not load shipments. Check your connection.');
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

  // ── Computed stats ──────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const active = shipments.filter(s => s.current_phase !== 'completed');
  const inTransit = shipments.filter(s => s.current_phase === 'transit').length;
  const deliveredToday = shipments.filter(
    s => s.current_phase === 'completed' && s.completed_at?.slice(0, 10) === today
  ).length;

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingLabel}>Loading shipments...</Text>
      </View>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header greeting */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Good day,</Text>
          <Text style={styles.adminName}>{user?.name ?? 'Admin'}</Text>
        </View>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>D</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard label="Active" value={active.length} icon="📦" />
        <StatCard label="In Transit" value={inTransit} icon="✈" />
        <StatCard label="Delivered Today" value={deliveredToday} icon="✅" />
      </View>

      {/* Active shipments list */}
      <Text style={styles.sectionHeader}>Active Shipments ({active.length})</Text>

      {active.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No active shipments</Text>
          <Text style={styles.emptySubtitle}>
            Create one using the + tab below.
          </Text>
        </View>
      ) : (
        active.map(s => <ShipmentCard key={s.id} shipment={s} />)
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 24,
  },
  errorText: {
    fontSize: 15,
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

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  adminName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Loading label
  loadingLabel: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // Section header
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Shipment cards
  shipmentCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  shipmentCardTop: {
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
    marginBottom: 10,
  },
  shipmentCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transportTag: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  transportTagText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  eta: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Phase badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
