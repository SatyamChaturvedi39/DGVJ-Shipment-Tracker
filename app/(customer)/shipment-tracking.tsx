import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker, Region } from 'react-native-maps';
import { Colors } from '@/constants/colors';
import { Config } from '@/constants/config';
import { getShipment, getLatestLocation } from '@/services/api';
import type { ShipmentDetail, ShipmentPhase, StatusEvent, LocationUpdate } from '@/types';

// MANUAL TEST REQUIRED: Tracking screen shows correct phase UI
//   Open the tracking screen for a shipment and verify the correct section is shown:
//   - pickup phase   → LiveMapSection visible with map (or placeholder if no GPS yet)
//   - transit phase  → TransitCard visible with train/plane icon and transport number
//   - delivery phase → LiveMapSection visible (delivery driver's GPS)
//   - completed phase → green "Delivered" card replaces the ETA card; map is hidden
//
// MANUAL TEST REQUIRED: Map appears for pickup/delivery phase
//   1. With a shipment in pickup or delivery phase that has a real employee sharing GPS,
//      open the tracking screen
//   2. The MapView (220px tall) must render with a red marker at the driver's location
//   3. The marker must move in real-time as the driver moves (WebSocket) or on 10s poll
//   4. On devices without a Google Maps key: MapView renders in Expo Go without a key
//
// MANUAL TEST REQUIRED: Transit card appears for transit phase
//   1. Advance a shipment to transit phase (Admin → Shipment Detail → Advance)
//   2. Open the customer tracking screen for that shipment
//   3. TransitCard must show: large train/plane icon, transport number, and any status
//      events added by Admin (mini-timeline below the card)
//
// MANUAL TEST REQUIRED: Status timeline updates after phase change
//   1. With the tracking screen open, have Admin advance the shipment phase
//   2. Within a few seconds (WebSocket push or 10s poll), the phase progress dots
//      and status timeline must update without manually refreshing

// ─── Phase progress ───────────────────────────────────────────────────────────

const PHASES: ShipmentPhase[] = ['pickup', 'transit', 'delivery', 'completed'];
const PHASE_LABELS: Record<ShipmentPhase, string> = {
  pickup:    'Pickup',
  transit:   'Transit',
  delivery:  'Delivery',
  completed: 'Delivered',
};

function PhaseProgressBar({ currentPhase }: { currentPhase: ShipmentPhase }) {
  const currentIdx = PHASES.indexOf(currentPhase);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseAnim]);

  return (
    <View style={progress.wrapper}>
      {PHASES.map((phase, idx) => {
        const isDone    = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture  = idx > currentIdx;

        return (
          <React.Fragment key={phase}>
            {idx > 0 && (
              <View style={[progress.line, isDone ? progress.lineDone : progress.lineFuture]} />
            )}
            <View style={progress.step}>
              {isCurrent ? (
                <Animated.View style={[progress.dot, progress.dotCurrent, { opacity: pulseAnim }]} />
              ) : (
                <View
                  style={[
                    progress.dot,
                    isDone ? progress.dotDone : isFuture ? progress.dotFuture : progress.dotDone,
                  ]}
                />
              )}
              <Text style={[
                progress.label,
                isDone    ? progress.labelDone    : null,
                isCurrent ? progress.labelCurrent : null,
                isFuture  ? progress.labelFuture  : null,
              ]}>
                {PHASE_LABELS[phase]}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const progress = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  step: {
    alignItems: 'center',
    width: 60,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 6,
  },
  dotDone:    { backgroundColor: Colors.primary },
  dotCurrent: { backgroundColor: Colors.primary },
  dotFuture:  { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  line: {
    flex: 1,
    height: 2,
    marginTop: 7,
    marginHorizontal: -2,
  },
  lineDone:   { backgroundColor: Colors.primary },
  lineFuture: { backgroundColor: 'rgba(255,255,255,0.2)' },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelDone:    { color: Colors.primaryLight },
  labelCurrent: { color: '#FFFFFF', fontWeight: '800' },
  labelFuture:  { color: 'rgba(255,255,255,0.45)' },
});

// ─── Status human label ───────────────────────────────────────────────────────

function getStatusLabel(phase: ShipmentPhase, transportMode?: string): string {
  switch (phase) {
    case 'pickup':    return 'Driver heading to pickup';
    case 'transit':   return `In transit via ${transportMode === 'air' ? 'Air' : 'Train'}`;
    case 'delivery':  return 'Out for delivery';
    case 'completed': return 'Delivered';
  }
}

// ─── Timeline item ────────────────────────────────────────────────────────────

function TimelineItem({ event, isLast }: { event: StatusEvent; isLast: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!event.is_completed) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [event.is_completed, pulseAnim]);

  const isPending = !event.is_completed;

  return (
    <View style={tl.row}>
      <View style={tl.left}>
        {event.is_completed ? (
          <View style={[tl.dot, tl.dotDone]}>
            <Text style={tl.dotCheck}>✓</Text>
          </View>
        ) : (
          <Animated.View style={[tl.dot, tl.dotCurrent, { opacity: pulseAnim }]} />
        )}
        {!isLast && <View style={[tl.line, event.is_completed ? tl.lineDone : tl.linePending]} />}
      </View>
      <View style={tl.content}>
        <Text style={[tl.label, isPending && tl.labelPending]}>{event.label}</Text>
        {event.description ? <Text style={tl.desc}>{event.description}</Text> : null}
        <Text style={tl.time}>
          {event.is_completed
            ? new Date(event.timestamp).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Pending'}
        </Text>
      </View>
    </View>
  );
}

const tl = StyleSheet.create({
  row:         { flexDirection: 'row', marginBottom: 0 },
  left:        { width: 32, alignItems: 'center' },
  dot:         { width: 22, height: 22, borderRadius: 11, marginTop: 1, justifyContent: 'center', alignItems: 'center' },
  dotDone:     { backgroundColor: Colors.success },
  dotCurrent:  { backgroundColor: Colors.primary },
  dotPending:  { backgroundColor: Colors.border, borderWidth: 2, borderColor: Colors.textMuted },
  dotCheck:    { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  line:        { flex: 1, width: 2, marginVertical: 3 },
  lineDone:    { backgroundColor: Colors.success },
  linePending: { backgroundColor: Colors.border },
  content:     { flex: 1, paddingBottom: 20, paddingLeft: 10 },
  label:       { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  labelPending:{ color: Colors.textSecondary },
  desc:        { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  time:        { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
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

// ─── Expandable details ───────────────────────────────────────────────────────

function ExpandableDetails({ shipment }: { shipment: ShipmentDetail }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.expandHeader}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>SHIPMENT DETAILS</Text>
        <Text style={styles.expandCaret}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.sectionCard}>
          <InfoRow label="Origin"           value={shipment.origin} />
          <InfoRow label="Destination"      value={shipment.destination} />
          <InfoRow
            label="Transport"
            value={`${shipment.transport_mode === 'air' ? '✈ Air' : '🚂 Train'} — ${shipment.transport_number}`}
          />
          {shipment.goods_description ? (
            <InfoRow label="Goods" value={shipment.goods_description} />
          ) : null}
          {shipment.notes ? (
            <InfoRow label="Notes" value={shipment.notes} />
          ) : null}
        </View>
      )}
    </View>
  );
}

// ─── Live map section ─────────────────────────────────────────────────────────

function LiveMapSection({
  shipmentId,
  wsRef,
  onPhaseChange,
}: {
  shipmentId: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
  onPhaseChange: () => void;
}) {
  const [location, setLocation] = useState<LocationUpdate | null>(null);
  const [fetching, setFetching] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLocation = useCallback(async () => {
    try {
      const loc = await getLatestLocation(shipmentId);
      if (loc) setLocation(loc);
    } catch {
      // No location yet — leave as null
    } finally {
      setFetching(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    fetchLocation();
    intervalRef.current = setInterval(fetchLocation, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLocation]);

  // WebSocket live updates (set up by parent, we read from wsRef but also handle here)
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const onMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'location') {
          setLocation(prev => ({
            id: prev?.id ?? '',
            shipment_id: shipmentId,
            employee_id: data.employee_id ?? '',
            lat: data.lat,
            lng: data.lng,
            timestamp: new Date().toISOString(),
          }));
        } else if (data.type === 'phase_change' || data.type === 'status_update') {
          onPhaseChange();
        }
      } catch {
        // ignore malformed WS messages
      }
    };

    ws.addEventListener('message', onMessage);
    return () => ws.removeEventListener('message', onMessage);
  }, [wsRef, shipmentId, onPhaseChange]);

  if (fetching) {
    return (
      <View style={styles.mapPlaceholder}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderIcon}>📍</Text>
        <Text style={styles.mapPlaceholderText}>
          Tracking will begin when driver starts their journey
        </Text>
      </View>
    );
  }

  const region: Region = {
    latitude: location.lat,
    longitude: location.lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View>
      <MapView
        style={styles.map}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker
          coordinate={{ latitude: location.lat, longitude: location.lng }}
          title="Driver Location"
        />
      </MapView>
      <View style={styles.mapLabel}>
        <Text style={styles.mapLabelDot}>🟢</Text>
        <Text style={styles.mapLabelText}>Driver is on the way</Text>
        <Text style={styles.mapLabelTime}>
          Updated {new Date(location.timestamp).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

// ─── Transit section ──────────────────────────────────────────────────────────

function TransitSection({ shipment }: { shipment: ShipmentDetail }) {
  const icon = shipment.transport_mode === 'air' ? '✈️' : '🚂';
  const modeLabel = shipment.transport_mode === 'air' ? 'Airways' : 'Railways';

  const manualEvents = shipment.status_events?.filter(e => e.is_completed) ?? [];

  return (
    <View>
      <View style={styles.transitCard}>
        <Text style={styles.transitIcon}>{icon}</Text>
        <Text style={styles.transitNumber}>{shipment.transport_number}</Text>
        <View style={styles.transitRoute}>
          <Text style={styles.transitCity}>{shipment.origin}</Text>
          <Text style={styles.transitArrow}> → </Text>
          <Text style={styles.transitCity}>{shipment.destination}</Text>
        </View>
        <Text style={styles.transitMode}>In transit via {modeLabel}</Text>
      </View>

      {manualEvents.length > 0 && (
        <View style={[styles.sectionCard, { marginTop: 12 }]}>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>ADMIN UPDATES</Text>
          {manualEvents.map((ev, idx) => (
            <View key={ev.id} style={tl.row}>
              <View style={tl.left}>
                <View style={[tl.dot, tl.dotDone]}>
                  <Text style={tl.dotCheck}>✓</Text>
                </View>
                {idx < manualEvents.length - 1 && <View style={[tl.line, tl.lineDone]} />}
              </View>
              <View style={tl.content}>
                <Text style={tl.label}>{ev.label}</Text>
                {ev.description ? <Text style={tl.desc}>{ev.description}</Text> : null}
                <Text style={tl.time}>
                  {new Date(ev.timestamp).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ShipmentTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

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

  // WebSocket connection
  useEffect(() => {
    if (!id) return;

    const ws = new WebSocket(`${Config.WS_BASE_URL}/ws/${id}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'phase_change' || data.type === 'status_update') {
          load();
        }
        // 'location' type is handled inside LiveMapSection via wsRef
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      // WS errors are non-fatal — REST polling handles updates
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [id, load]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingLabel}>Loading tracking info...</Text>
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

  const phase = shipment.current_phase;
  const isLiveTracking = phase === 'pickup' || phase === 'delivery';
  const isTransit   = phase === 'transit';
  const isCompleted = phase === 'completed';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Section 1: Dark header card ───────────────────────────────── */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTrackingId}>{shipment.tracking_id}</Text>
        <Text style={styles.headerStatus}>
          {getStatusLabel(phase, shipment.transport_mode)}
        </Text>
        <PhaseProgressBar currentPhase={phase} />
      </View>

      {/* ── Section 2: ETA card ───────────────────────────────────────── */}
      {isCompleted ? (
        <View style={styles.deliveredCard}>
          <Text style={styles.deliveredIcon}>✓</Text>
          <View>
            <Text style={styles.deliveredTitle}>Shipment Delivered</Text>
            {shipment.completed_at ? (
              <Text style={styles.deliveredDate}>
                {new Date(shipment.completed_at).toLocaleString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        shipment.eta_date ? (
          <View style={styles.etaCard}>
            <Text style={styles.etaCardLabel}>Estimated Delivery</Text>
            <Text style={styles.etaCardDate}>{shipment.eta_date}</Text>
            {shipment.eta_time ? (
              <Text style={styles.etaCardTime}>{shipment.eta_time}</Text>
            ) : null}
          </View>
        ) : null
      )}

      {/* ── Section 3: Live tracking / Transit / Completed ────────────── */}
      {isLiveTracking && (
        <Section title={phase === 'pickup' ? 'DRIVER LOCATION (PICKUP)' : 'DRIVER LOCATION (DELIVERY)'}>
          <LiveMapSection
            shipmentId={shipment.id}
            wsRef={wsRef}
            onPhaseChange={load}
          />
        </Section>
      )}

      {isTransit && (
        <Section title="TRANSIT STATUS">
          <TransitSection shipment={shipment} />
        </Section>
      )}

      {/* ── Section 4: Full status timeline ──────────────────────────── */}
      {shipment.status_events?.length > 0 && (
        <Section title="STATUS TIMELINE">
          {shipment.status_events.map((ev, idx) => (
            <TimelineItem
              key={ev.id}
              event={ev}
              isLast={idx === shipment.status_events.length - 1}
            />
          ))}
        </Section>
      )}

      {/* ── Section 5: Expandable shipment details ────────────────────── */}
      <ExpandableDetails shipment={shipment} />

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
  loadingLabel: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
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
  backLink:     { paddingVertical: 8 },
  backLinkText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },

  // Header card (dark navy)
  headerCard: {
    backgroundColor: Colors.darkHeader,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
  },
  headerTrackingId: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerStatus: {
    fontSize: 14,
    color: '#AAAACC',
    fontWeight: '500',
  },

  // ETA card
  etaCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    alignItems: 'center',
  },
  etaCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  etaCardDate: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  etaCardTime: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Delivered card
  deliveredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
    padding: 18,
    gap: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  deliveredIcon: {
    fontSize: 32,
    color: Colors.success,
    fontWeight: '800',
  },
  deliveredTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.success,
    marginBottom: 2,
  },
  deliveredDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Section wrapper
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // Expandable details
  expandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  expandCaret: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Info rows
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

  // Map
  map: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  mapLabelDot: { fontSize: 12 },
  mapLabelText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  mapLabelTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  mapPlaceholder: {
    height: 140,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 20,
  },
  mapPlaceholderIcon: { fontSize: 28 },
  mapPlaceholderText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Transit card
  transitCard: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  transitIcon: { fontSize: 56, marginBottom: 10 },
  transitNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
    letterSpacing: 1,
  },
  transitRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  transitCity: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  transitArrow: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  transitMode: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
