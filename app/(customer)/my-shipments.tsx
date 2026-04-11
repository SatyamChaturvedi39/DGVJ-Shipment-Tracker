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
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { getShipments } from '@/services/api';
import { formatETA } from '@/utils/formatDate';
import type { Shipment, ShipmentPhase, TransportMode } from '@/types';

// MANUAL TEST REQUIRED: My Shipments shows permitted shipments only
//   1. Log in as a customer (real phone OTP or Firebase test number)
//   2. Only shipments where this customer's user ID is in shipment_permissions must appear
//   3. Shipments NOT granted to this customer must not be visible
//   4. Search bar filters by tracking ID — verify partial matches work
//   5. Tap a shipment card → navigates to the tracking screen

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_BADGE: Record<ShipmentPhase, { bg: string; text: string }> = {
  pickup:            { bg: '#FFF8E1', text: '#F57F17' },
  transit:           { bg: '#E3F2FD', text: '#1565C0' },
  handed_to_carrier: { bg: '#F3E5F5', text: '#6A1B9A' },
  out_for_delivery:  { bg: '#FFF8E1', text: '#F57F17' },
  completed:         { bg: '#E8F5E9', text: '#2E7D32' },
};

const PHASE_ACCENT: Record<ShipmentPhase, string> = {
  pickup:            '#F57F17',
  transit:           '#1565C0',
  handed_to_carrier: '#6A1B9A',
  out_for_delivery:  '#F57F17',
  completed:         '#2E7D32',
};

function getStatusLabel(shipment: Shipment): string {
  switch (shipment.current_phase) {
    case 'pickup':            return '📦 Driver heading to pickup';
    case 'transit':           return `🚗 Heading to ${shipment.transport_mode === 'air' ? 'airport' : 'railway station'}`;
    case 'handed_to_carrier': return `${shipment.transport_mode === 'air' ? '✈' : '🚂'} In transit via ${shipment.transport_mode === 'air' ? 'Air' : 'Train'}`;
    case 'out_for_delivery':  return '🛵 Out for delivery';
    case 'completed':         return '✓ Delivered';
  }
}

function getTransportIcon(mode: TransportMode): string {
  return mode === 'air' ? '✈️' : '🚂';
}

// ─── Shipment card ────────────────────────────────────────────────────────────

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const badge = PHASE_BADGE[shipment.current_phase];
  const accentColor = PHASE_ACCENT[shipment.current_phase];
  const isCompleted = shipment.current_phase === 'completed';

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: accentColor }]}
      activeOpacity={0.75}
      onPress={() => router.push(`/(customer)/shipment-tracking?id=${shipment.id}`)}
    >
      {/* Top row: tracking ID + transport icon */}
      <View style={styles.cardTop}>
        <Text style={styles.trackingId}>{shipment.tracking_id}</Text>
        <Text style={styles.transportIcon}>{getTransportIcon(shipment.transport_mode)}</Text>
      </View>

      {/* Route */}
      <View style={styles.routeRow}>
        <Text style={styles.routeCity}>{shipment.origin}</Text>
        <Text style={styles.routeArrow}>  →  </Text>
        <Text style={styles.routeCity}>{shipment.destination}</Text>
      </View>

      {/* Status badge */}
      <View style={styles.cardBottom}>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: badge.text }]}>
            {getStatusLabel(shipment)}
          </Text>
        </View>
        {isCompleted ? null : (
          shipment.eta_date ? (
            <Text style={styles.eta}>
              ETA {formatETA(shipment.eta_date, shipment.eta_time)}
            </Text>
          ) : null
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function MyShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getShipments();
      setShipments(data);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Unknown error';
      setError(`Could not load shipments: ${msg}`);
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

  // Filter by tracking ID, origin, or destination
  const filtered = query.trim()
    ? shipments.filter(s => {
        const q = query.toLowerCase();
        return (
          s.tracking_id.toLowerCase().includes(q) ||
          s.origin.toLowerCase().includes(q) ||
          s.destination.toLowerCase().includes(q)
        );
      })
    : shipments;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
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
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by tracking ID, origin, destination…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{shipments.length === 0 ? '📦' : '🔍'}</Text>
            <Text style={styles.emptyTitle}>
              {shipments.length === 0 ? 'No shipments assigned to you yet' : 'No results found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {shipments.length === 0
                ? 'Contact Digvijay Express to get access to your shipments.'
                : `No shipments match "${query}". Try a different search.`}
            </Text>
          </View>
        ) : (
          filtered.map(s => <ShipmentCard key={s.id} shipment={s} />)
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

  // Search bar
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
  },

  // List
  list: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },

  // Shipment card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackingId: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  transportIcon: {
    fontSize: 20,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeCity: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  routeArrow: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  eta: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
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
    lineHeight: 20,
  },
});
