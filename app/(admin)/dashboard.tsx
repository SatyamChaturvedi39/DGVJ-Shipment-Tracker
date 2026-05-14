import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { PHASE_CONFIG, PHASE_BORDER } from '@/constants/phases';
import { getShipments } from '@/services/api';
import { formatETA } from '@/utils/formatDate';
import { useAuth } from '@/hooks/useAuth';
import type { Shipment, ShipmentPhase } from '@/types';

// ─── Phase badge ─────────────────────────────────────────────────────────────

function PhaseBadge({ phase }: { phase: ShipmentPhase }) {
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.pickup;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Stat pill (horizontal scroll) ───────────────────────────────────────────

function StatPill({
  label, value, accent,
}: { label: string; value: number; accent: string }) {
  return (
    <View style={[styles.statPill, { borderTopColor: accent }]}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Shipment card ───────────────────────────────────────────────────────────

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const borderColor = PHASE_BORDER[shipment.current_phase] ?? Colors.border;
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: borderColor }]}
      activeOpacity={0.72}
      onPress={() => router.push(`/(admin)/shipment-detail?id=${shipment.id}`)}
    >
      <View style={styles.cardTop}>
        <Text style={styles.trackingId}>{shipment.tracking_id}</Text>
        <PhaseBadge phase={shipment.current_phase} />
      </View>

      <Text style={styles.route}>
        <Text style={styles.routeCity}>{shipment.origin}</Text>
        <Ionicons name="arrow-forward" size={14} color={Colors.textSecondary} style={{ marginHorizontal: 8 }} />
        <Text style={styles.routeCity}>{shipment.destination}</Text>
      </Text>

      <View style={styles.cardBottom}>
        <View style={styles.transportChip}>
          <Text style={styles.transportChipText}>
            {shipment.transport_mode === 'air' ? '✈' : '🚂'}  {shipment.transport_number ?? '—'}
          </Text>
        </View>
        <Text style={styles.eta}>
          {shipment.eta_date ? formatETA(shipment.eta_date, shipment.eta_time) : ''}
        </Text>
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
      setShipments(await getShipments());
    } catch {
      setError('Could not load shipments. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const active      = shipments.filter(s => s.current_phase !== 'completed');
  const pickup      = shipments.filter(s => s.current_phase === 'pickup').length;
  const outDelivery = shipments.filter(s => s.current_phase === 'out_for_delivery').length;
  const delivered   = shipments.filter(
    s => s.current_phase === 'completed' && s.completed_at?.slice(0, 10) === today
  ).length;

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingLabel}>Loading shipments…</Text>
      </View>
    );
  }

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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(true); }}
          tintColor={Colors.primary}
        />
      }
    >
      {/* ── Greeting header ─────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.adminName}>{user?.name ?? 'Admin'}</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {(user?.name ?? 'A')[0].toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── Stats horizontal scroll ──────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsScroll}
      >
        <StatPill label="Active"          value={active.length}  accent={Colors.primary} />
        <StatPill label="Pickup"          value={pickup}         accent="#F57F17" />
        <StatPill label="Out for Delivery" value={outDelivery}   accent="#1565C0" />
        <StatPill label="Delivered Today" value={delivered}      accent={Colors.success} />
      </ScrollView>

      {/* ── Active list ──────────────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Active Shipments</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{active.length}</Text>
        </View>
      </View>

      {active.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No active shipments</Text>
          <Text style={styles.emptySubtitle}>Tap the + tab to create one.</Text>
        </View>
      ) : (
        active.map(s => <ShipmentCard key={s.id} shipment={s} />)
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content:   { padding: 16, paddingBottom: 40 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 24 },

  loadingLabel: { marginTop: 12, fontSize: 14, color: Colors.textSecondary },
  errorText:    { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  retryBtn:     { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText:    { color: '#FFF', fontWeight: '700', fontSize: 15 },

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
    marginBottom: 2,
  },
  adminName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 18,
  },

  // Stats
  statsScroll: {
    gap: 10,
    paddingBottom: 4,
    marginBottom: 24,
  },
  statPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    minWidth: 110,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Shipment card
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transportChip: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  transportChipText: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  eta: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 56,
  },
  emptyIcon: {
    fontSize: 52,
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
  },
});
