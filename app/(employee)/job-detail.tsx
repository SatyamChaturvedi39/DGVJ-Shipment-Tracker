import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import { Colors } from '@/constants/colors';
import { Config } from '@/constants/config';
import { getShipment, transitionPhase, updateLocation } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { ShipmentDetail, StatusEvent, ShipmentPhase } from '@/types';

// MANUAL TEST REQUIRED: GPS tracking section appears for correct phase
//   1. Open a shipment in "Pickup" phase as the pickup employee
//   2. GPS tracking section (pulsing dot, coordinates) must be visible
//   3. The section must NOT be visible for a delivery employee in pickup phase
//   4. In dev mode: GPS coordinates update on screen but POST /location/update is
//      skipped (admin token 403) — verify no crash, just silent skip
//
// MANUAL TEST REQUIRED: Mark as Picked Up transitions phase correctly
//   1. Open a shipment in "Pickup" phase as its pickup employee
//   2. Tap "Mark as Picked Up" → confirm → phase must change to "transit"
//   3. GPS section disappears; job moves to Completed tab after refresh
//
// MANUAL TEST REQUIRED: Mark as Delivered transitions phase correctly
//   1. Open a shipment in "Delivery" phase as its delivery employee
//   2. Tap "Mark as Delivered" → confirm → phase must change to "completed"
//   3. Job moves to Completed tab; completed_at is set in the DB

// ─── Phase helpers ────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<ShipmentPhase, { label: string; bg: string; text: string }> = {
  pickup:    { label: 'Pickup',     bg: '#FFF8E1', text: '#F57F17' },
  transit:   { label: 'In Transit', bg: '#E3F2FD', text: '#1565C0' },
  delivery:  { label: 'Delivery',   bg: '#FFF8E1', text: '#F57F17' },
  completed: { label: 'Completed',  bg: '#E8F5E9', text: '#2E7D32' },
};

function PhaseBadge({ phase }: { phase: ShipmentPhase }) {
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.pickup;
  return (
    <View style={[badge.container, { backgroundColor: cfg.bg }]}>
      <Text style={[badge.text, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  text: { fontSize: 13, fontWeight: '700' },
});

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: 'pickup' | 'delivery' }) {
  const isPickup = role === 'pickup';
  return (
    <View
      style={[
        roleBadge.container,
        isPickup ? roleBadge.pickup : roleBadge.delivery,
      ]}
    >
      <Text style={roleBadge.text}>
        {isPickup ? 'PICKUP DRIVER' : 'DELIVERY DRIVER'}
      </Text>
    </View>
  );
}

const roleBadge = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  pickup: { backgroundColor: '#FFF3E0' },
  delivery: { backgroundColor: '#E8F5E9' },
  text: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: Colors.textPrimary },
});

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? '—'}</Text>
    </View>
  );
}

// ─── Timeline item ────────────────────────────────────────────────────────────

function TimelineItem({ event, isLast }: { event: StatusEvent; isLast: boolean }) {
  return (
    <View style={tl.row}>
      <View style={tl.left}>
        <View style={[tl.dot, event.is_completed ? tl.dotDone : tl.dotPending]} />
        {!isLast && (
          <View style={[tl.line, event.is_completed ? tl.lineDone : tl.linePending]} />
        )}
      </View>
      <View style={tl.content}>
        <Text style={[tl.label, event.is_completed ? tl.labelDone : tl.labelPending]}>
          {event.label}
        </Text>
        {event.description ? <Text style={tl.desc}>{event.description}</Text> : null}
        <Text style={tl.time}>
          {new Date(event.timestamp).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

const tl = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 0 },
  left: { width: 28, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 3 },
  dotDone: { backgroundColor: Colors.success },
  dotPending: { backgroundColor: Colors.border, borderWidth: 2, borderColor: Colors.textMuted },
  line: { flex: 1, width: 2, marginVertical: 2 },
  lineDone: { backgroundColor: Colors.success },
  linePending: { backgroundColor: Colors.border },
  content: { flex: 1, paddingBottom: 20, paddingLeft: 10 },
  label: { fontSize: 14, fontWeight: '600' },
  labelDone: { color: Colors.textPrimary },
  labelPending: { color: Colors.textSecondary },
  desc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  time: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
});

// ─── Pulsing dot ─────────────────────────────────────────────────────────────

function PulsingDot() {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);

  return (
    <Animated.View style={[styles.pulsingDot, { opacity: anim }]} />
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tracking, setTracking] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const [transitioning, setTransitioning] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await getShipment(id);
      setShipment(detail);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Unknown error';
      setError(`Could not load shipment: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Cleanup GPS watcher on unmount
  useEffect(() => {
    return () => {
      locationSub.current?.remove();
    };
  }, []);

  // ── Determine this employee's role ───────────────────────────────────────
  const userId = user?.id ?? '';
  const employeeRole: 'pickup' | 'delivery' =
    shipment?.delivery_employee_id === userId ? 'delivery' : 'pickup';

  // Show GPS section only when phase matches this employee's role
  const showGps =
    shipment !== null &&
    ((employeeRole === 'pickup' && shipment.current_phase === 'pickup') ||
      (employeeRole === 'delivery' && shipment.current_phase === 'delivery'));

  // ── GPS tracking ─────────────────────────────────────────────────────────

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location Permission Required',
        'Digvijay BLR needs your location to track shipment delivery. Please enable location permission in settings.',
      );
      return;
    }

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setCurrentCoords({ lat, lng });

        // In dev mode, dev-mock-token maps to admin role on the backend,
        // which is rejected by the employee-only /location/update endpoint.
        // Skip the API call in dev mode to allow UI testing.
        if (Config.DEV_MOCK_AUTH) return;

        try {
          await updateLocation({ shipment_id: id!, lat, lng });
        } catch (e) {
          console.warn('[GPS] Location update failed:', e);
        }
      },
    );

    locationSub.current = sub;
    setTracking(true);
  };

  const stopTracking = () => {
    locationSub.current?.remove();
    locationSub.current = null;
    setTracking(false);
    setCurrentCoords(null);
  };

  const handleTrackingToggle = () => {
    if (tracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  // ── Phase transitions ────────────────────────────────────────────────────

  const handleMarkPickedUp = () => {
    Alert.alert(
      'Mark as Picked Up',
      'Confirm that the goods have been picked up from the sender?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setTransitioning(true);
            stopTracking();
            try {
              await transitionPhase(id!, 'transit');
              Alert.alert('Success', 'Shipment marked as picked up. It is now In Transit.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (e: any) {
              const msg = e?.response?.data?.detail ?? 'Failed to update shipment. Try again.';
              Alert.alert('Error', msg);
            } finally {
              setTransitioning(false);
            }
          },
        },
      ],
    );
  };

  const handleMarkDelivered = () => {
    Alert.alert(
      'Mark as Delivered',
      'Confirm that the goods have been delivered to the recipient?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            setTransitioning(true);
            stopTracking();
            try {
              await transitionPhase(id!, 'completed');
              Alert.alert('Success', 'Shipment marked as delivered and completed!', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (e: any) {
              const msg = e?.response?.data?.detail ?? 'Failed to update shipment. Try again.';
              Alert.alert('Error', msg);
            } finally {
              setTransitioning(false);
            }
          },
        },
      ],
    );
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !shipment) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Shipment not found.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isCompleted = shipment.current_phase === 'completed';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Header card ──────────────────────────────────────────────── */}
      <View style={styles.headerCard}>
        <Text style={styles.trackingId}>{shipment.tracking_id}</Text>
        <View style={styles.headerMeta}>
          <PhaseBadge phase={shipment.current_phase} />
          <RoleBadge role={employeeRole} />
        </View>
      </View>

      {/* ── Route ────────────────────────────────────────────────────── */}
      <Section title="Route">
        <View style={styles.routeRow}>
          <View style={styles.routeCity}>
            <Text style={styles.routeCityLabel}>FROM</Text>
            <Text style={styles.routeCityName}>{shipment.origin}</Text>
          </View>
          <Text style={styles.routeArrow}>→</Text>
          <View style={[styles.routeCity, styles.routeCityRight]}>
            <Text style={styles.routeCityLabel}>TO</Text>
            <Text style={styles.routeCityName}>{shipment.destination}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <InfoRow
          label={shipment.transport_mode === 'air' ? '✈ Flight' : '🚂 Train'}
          value={shipment.transport_number}
        />
        {shipment.eta_date ? (
          <InfoRow
            label="ETA"
            value={`${shipment.eta_date}${shipment.eta_time ? '  ' + shipment.eta_time : ''}`}
          />
        ) : null}
      </Section>

      {/* ── Goods ────────────────────────────────────────────────────── */}
      {shipment.goods_description ? (
        <Section title="Goods">
          <InfoRow label="Description" value={shipment.goods_description} />
          {shipment.notes ? <InfoRow label="Notes" value={shipment.notes} /> : null}
        </Section>
      ) : null}

      {/* ── Status timeline ──────────────────────────────────────────── */}
      {shipment.status_events?.length > 0 && (
        <Section title="Status Timeline">
          {shipment.status_events.map((ev, idx) => (
            <TimelineItem
              key={ev.id}
              event={ev}
              isLast={idx === shipment.status_events.length - 1}
            />
          ))}
        </Section>
      )}

      {/* ── GPS Tracking section ─────────────────────────────────────── */}
      {showGps && !isCompleted && (
        <Section title="GPS Tracking">
          {/* Tracking status */}
          {tracking && (
            <View style={styles.trackingStatus}>
              <PulsingDot />
              <View style={styles.trackingStatusText}>
                <Text style={styles.trackingActiveLabel}>Live Tracking Active</Text>
                {currentCoords ? (
                  <Text style={styles.trackingCoords}>
                    {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                  </Text>
                ) : (
                  <Text style={styles.trackingCoords}>Acquiring location…</Text>
                )}
              </View>
            </View>
          )}

          {/* Toggle button */}
          <TouchableOpacity
            style={[styles.trackingBtn, tracking ? styles.trackingBtnActive : styles.trackingBtnInactive]}
            onPress={handleTrackingToggle}
            activeOpacity={0.8}
          >
            <Text style={[styles.trackingBtnText, !tracking && styles.trackingBtnTextInactive]}>
              {tracking ? 'STOP TRACKING' : 'START TRACKING'}
            </Text>
          </TouchableOpacity>

          {Config.DEV_MOCK_AUTH && (
            <Text style={styles.devNote}>
              Dev mode: GPS UI active, location updates skipped (backend requires employee role)
            </Text>
          )}
        </Section>
      )}

      {/* ── Action buttons ───────────────────────────────────────────── */}
      {!isCompleted && (
        <View style={styles.actionsSection}>
          <Text style={styles.actionsSectionTitle}>Actions</Text>

          {/* Mark as Picked Up — pickup driver only, phase = pickup */}
          {employeeRole === 'pickup' && shipment.current_phase === 'pickup' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnAmber, transitioning && styles.actionBtnDisabled]}
              onPress={handleMarkPickedUp}
              disabled={transitioning}
              activeOpacity={0.8}
            >
              {transitioning ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionBtnText}>Mark as Picked Up</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Mark as Delivered — delivery driver only, phase = delivery */}
          {employeeRole === 'delivery' && shipment.current_phase === 'delivery' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGreen, transitioning && styles.actionBtnDisabled]}
              onPress={handleMarkDelivered}
              disabled={transitioning}
              activeOpacity={0.8}
            >
              {transitioning ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionBtnText}>Mark as Delivered</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Completed banner */}
      {isCompleted && shipment.completed_at && (
        <View style={styles.completedBanner}>
          <Text style={styles.completedBannerIcon}>✓</Text>
          <View>
            <Text style={styles.completedBannerTitle}>Shipment Completed</Text>
            <Text style={styles.completedBannerDate}>
              {new Date(shipment.completed_at).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
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
    marginBottom: 12,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  backLink: { paddingVertical: 8 },
  backLinkText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },

  // Header card
  headerCard: {
    backgroundColor: Colors.darkHeader,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  trackingId: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 12,
  },
  headerMeta: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  // Route
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  routeCity: { flex: 1 },
  routeCityRight: { alignItems: 'flex-end' },
  routeCityLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  routeCityName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  routeArrow: {
    fontSize: 22,
    color: Colors.primary,
    paddingHorizontal: 12,
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },

  // GPS tracking
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  pulsingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
  },
  trackingStatusText: { flex: 1 },
  trackingActiveLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  trackingCoords: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  trackingBtn: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingBtnActive: {
    backgroundColor: Colors.textSecondary,
  },
  trackingBtnInactive: {
    backgroundColor: Colors.primary,
  },
  trackingBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  trackingBtnTextInactive: {
    color: '#FFFFFF',
  },
  devNote: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Actions
  actionsSection: { marginTop: 4, marginBottom: 16 },
  actionsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  actionBtn: {
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionBtnAmber: { backgroundColor: '#F57F17' },
  actionBtnGreen: { backgroundColor: Colors.success },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },

  // Completed banner
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  completedBannerIcon: { fontSize: 28, color: Colors.success },
  completedBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.success,
    marginBottom: 2,
  },
  completedBannerDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
