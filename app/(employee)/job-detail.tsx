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
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import { Colors } from '@/constants/colors';
import { Config } from '@/constants/config';
import { PHASE_CONFIG, PHASE_ORDER as PHASE_STEPS } from '@/constants/phases';
import { getShipment, transitionPhase, updateLocation } from '@/services/api';
import { getIdToken } from '@/services/auth';
import { useAuth } from '@/hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_TASK_NAME } from '@/app/_layout';
import type { ShipmentDetail, StatusEvent, ShipmentPhase } from '@/types';
import { formatEventDate, formatETA, formatFullDate } from '@/utils/formatDate';

function carrierName(mode: string) {
  return mode === 'air' ? 'Airport' : 'Railway Station';
}

// ─── Phase step bar ───────────────────────────────────────────────────────────

const STEP_ICONS: Record<ShipmentPhase, string> = {
  pickup:            '📦',
  transit:           '🚗',
  handed_to_carrier: '✈',
  out_for_delivery:  '🛵',
  completed:         '✓',
};

function PhaseStepBar({ currentPhase }: { currentPhase: ShipmentPhase }) {
  const currentIdx = PHASE_STEPS.indexOf(currentPhase);
  return (
    <View style={stepBar.wrapper}>
      {PHASE_STEPS.map((phase, idx) => {
        const isDone    = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <React.Fragment key={phase}>
            {idx > 0 && (
              <View style={[stepBar.line, isDone ? stepBar.lineDone : stepBar.lineFuture]} />
            )}
            <View style={stepBar.step}>
              <View style={[stepBar.dot, isDone ? stepBar.dotDone : isCurrent ? stepBar.dotCurrent : stepBar.dotFuture]}>
                <Text style={[stepBar.dotIcon, !isDone && !isCurrent && stepBar.dotIconFuture]}>
                  {isDone ? '✓' : STEP_ICONS[phase]}
                </Text>
              </View>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const stepBar = StyleSheet.create({
  wrapper:       { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  step:          { alignItems: 'center' },
  dot:           { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  dotDone:       { backgroundColor: '#2E7D32' },
  dotCurrent:    { backgroundColor: Colors.primary },
  dotFuture:     { backgroundColor: 'rgba(255,255,255,0.2)' },
  dotIcon:       { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
  dotIconFuture: { opacity: 0.5 },
  line:          { flex: 1, height: 2 },
  lineDone:      { backgroundColor: '#2E7D32' },
  lineFuture:    { backgroundColor: 'rgba(255,255,255,0.2)' },
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
        {!isLast && <View style={[tl.line, event.is_completed ? tl.lineDone : tl.linePending]} />}
      </View>
      <View style={tl.content}>
        <Text style={[tl.label, event.is_completed ? tl.labelDone : tl.labelPending]}>
          {event.label}
        </Text>
        {event.description ? <Text style={tl.desc}>{event.description}</Text> : null}
        <Text style={tl.time}>
          {event.is_completed ? formatEventDate(event.timestamp) : 'Pending'}
        </Text>
      </View>
    </View>
  );
}

const tl = StyleSheet.create({
  row:         { flexDirection: 'row', marginBottom: 0 },
  left:        { width: 28, alignItems: 'center' },
  dot:         { width: 14, height: 14, borderRadius: 7, marginTop: 3 },
  dotDone:     { backgroundColor: Colors.success },
  dotPending:  { backgroundColor: Colors.border, borderWidth: 2, borderColor: Colors.textMuted },
  line:        { flex: 1, width: 2, marginVertical: 2 },
  lineDone:    { backgroundColor: Colors.success },
  linePending: { backgroundColor: Colors.border },
  content:     { flex: 1, paddingBottom: 20, paddingLeft: 10 },
  label:       { fontSize: 14, fontWeight: '600' },
  labelDone:   { color: Colors.textPrimary },
  labelPending:{ color: Colors.textSecondary },
  desc:        { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  time:        { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
});

// ─── Pulsing dot ─────────────────────────────────────────────────────────────

function PulsingDot({ color = Colors.primary }: { color?: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  return <Animated.View style={[styles.pulsingDot, { opacity: anim, backgroundColor: color }]} />;
}

// ─── GPS card ─────────────────────────────────────────────────────────────────

function GpsCard({
  tracking,
  currentCoords,
  onToggle,
}: {
  tracking: boolean;
  currentCoords: { lat: number; lng: number } | null;
  onToggle: () => void;
}) {
  return (
    <View style={gps.card}>
      {tracking ? (
        <View style={gps.activeRow}>
          <PulsingDot color="#2E7D32" />
          <View style={gps.activeText}>
            <Text style={gps.activeLabel}>Live Tracking Active</Text>
            <Text style={gps.coords}>
              {currentCoords
                ? `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}`
                : 'Acquiring GPS…'}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={gps.inactiveHint}>
          Share your live location with the customer so they can track their shipment.
        </Text>
      )}
      <TouchableOpacity
        style={[gps.btn, tracking ? gps.btnStop : gps.btnStart]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <Text style={gps.btnText}>{tracking ? '■  Stop Sharing Location' : '▶  Start Sharing Location'}</Text>
      </TouchableOpacity>
      {Config.DEV_MOCK_AUTH && (
        <Text style={gps.devNote}>Dev mode: GPS active locally, not sent to backend</Text>
      )}
    </View>
  );
}

const gps = StyleSheet.create({
  card:        { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  activeRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#F1F8E9' },
  activeText:  { flex: 1 },
  activeLabel: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
  coords:      { fontSize: 12, color: Colors.textSecondary, marginTop: 2, fontVariant: ['tabular-nums'] },
  inactiveHint:{ fontSize: 13, color: Colors.textSecondary, padding: 14, lineHeight: 20 },
  btn:         { margin: 10, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnStart:    { backgroundColor: Colors.primary },
  btnStop:     { backgroundColor: Colors.textSecondary },
  btnText:     { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  devNote:     { fontSize: 11, color: Colors.textMuted, textAlign: 'center', paddingBottom: 10, fontStyle: 'italic' },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [tracking, setTracking]           = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const [transitioning, setTransitioning] = useState(false);
  // Prevents WS phase_change alert from firing for the employee's own transitions
  const skipNextPhaseAlert = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setShipment(await getShipment(id));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        ?? (e instanceof Error ? e.message : 'Unknown error');
      setError(`Could not load shipment: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { locationSub.current?.remove(); }, []);

  // ── WebSocket: listen for admin phase overrides ───────────────────────────────
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!id) return;
    let ws: WebSocket;
    (async () => {
      const token = await getIdToken();
      const wsUrl = token
        ? `${Config.WS_BASE_URL}/ws/${id}?token=${encodeURIComponent(token)}`
        : `${Config.WS_BASE_URL}/ws/${id}`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'phase_change') {
            // If the employee triggered this transition themselves, skip the alert
            if (skipNextPhaseAlert.current) {
              skipNextPhaseAlert.current = false;
              load();
              return;
            }
            stopTracking();
            load();
            Alert.alert(
              'Phase Updated by Admin',
              `This shipment has been moved to "${String(data.phase ?? '').replace(/_/g, ' ')}". Your GPS tracking has been paused — please review your current action.`,
            );
          }
        } catch { /* ignore malformed messages */ }
      };
      ws.onerror = () => { /* non-fatal — screen still works without WS */ };
    })();
    return () => {
      if (ws) ws.close();
      wsRef.current = null;
    };
  }, [id, load]);

  // ── Role & GPS visibility ────────────────────────────────────────────────────
  const userId = user?.id ?? '';
  const employeeRole: 'pickup' | 'delivery' =
    shipment?.delivery_employee_id === userId ? 'delivery' : 'pickup';

  const isPickupEmployee  = Config.DEV_MOCK_AUTH || employeeRole === 'pickup';
  const isDeliveryEmployee = Config.DEV_MOCK_AUTH || employeeRole === 'delivery';

  // GPS is active for pickup driver (pickup + transit phases) and delivery driver (out_for_delivery)
  const phase = shipment?.current_phase;
  const showGps = shipment !== null && (
    (isPickupEmployee  && (phase === 'pickup' || phase === 'transit')) ||
    (isDeliveryEmployee && phase === 'out_for_delivery')
  );

  // ── GPS auto-start when phase CHANGES to a GPS-active phase ─────────────────
  // prevPhaseRef is null on initial load — we skip auto-start then.
  // Only auto-starts when the employee triggers a phase transition (not on load).
  const prevPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!shipment) return;
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = shipment.current_phase;
    if (prevPhase !== null && showGps && !tracking) {
      startTracking();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipment?.current_phase]);

  // ── GPS handlers ─────────────────────────────────────────────────────────────

  const startTracking = async () => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      Alert.alert('Location Required', 'Enable location permission to share your position.');
      return;
    }
    
    // Request background permission
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      Alert.alert('Background Location Recommended', 'For best results, allow location tracking "All the time" so updates continue while your phone is locked.', [{ text: 'OK' }]);
    }

    // Save shipment ID for the background task
    await AsyncStorage.setItem('active_tracking_shipment_id', id!);

    // Start background tracking
    if (bgStatus === 'granted') {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Live Tracking Active',
          notificationBody: 'Sharing your location for delivery.',
          notificationColor: '#C62828',
        },
      });
    }

    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentCoords({ lat, lng });
        if (Config.DEV_MOCK_AUTH) return;
        // If background tracking isn't granted, we must manually update here
        if (bgStatus !== 'granted') {
          try { await updateLocation({ shipment_id: id!, lat, lng }); }
          catch (e) { console.warn('[GPS] Location update failed:', e); }
        }
      },
    );
    locationSub.current = sub;
    setTracking(true);
  };

  const stopTracking = async () => {
    locationSub.current?.remove();
    locationSub.current = null;
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      await AsyncStorage.removeItem('active_tracking_shipment_id');
    } catch (e) {
      console.warn('[GPS] Error stopping background updates:', e);
    }
    setTracking(false);
    setCurrentCoords(null);
  };

  // ── Phase transition helpers ──────────────────────────────────────────────────

  // GPS phases: stay on screen and auto-start GPS after transition
  const GPS_CONTINUATION_PHASES: ShipmentPhase[] = ['transit', 'out_for_delivery'];

  const confirmTransition = (
    title: string,
    message: string,
    nextPhase: ShipmentPhase,
    successMsg: string,
  ) => {
    const continueGps = GPS_CONTINUATION_PHASES.includes(nextPhase);
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setTransitioning(true);
          // Mark as own transition so WS handler doesn't show the popup
          skipNextPhaseAlert.current = true;
          if (!continueGps) stopTracking();
          try {
            await transitionPhase(id!, nextPhase);
            if (continueGps) {
              // Stay on screen and reload so GPS auto-start useEffect fires
              await load();
            } else {
              Alert.alert('Done', successMsg, [{ text: 'OK', onPress: () => router.back() }]);
            }
          } catch (e: unknown) {
            skipNextPhaseAlert.current = false;
            const rawDetail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
            const msg = Array.isArray(rawDetail)
              ? (rawDetail as { msg?: string }[]).map(d => d?.msg ?? String(d)).join(', ')
              : (typeof rawDetail === 'string' ? rawDetail : (rawDetail ? JSON.stringify(rawDetail) : 'Failed to update. Try again.'));
            Alert.alert('Error', msg);
          } finally {
            setTransitioning(false);
          }
        },
      },
    ]);
  };

  // ── Loading / error ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingLabel}>Loading job…</Text>
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
          <Text style={styles.backLinkText}><Ionicons name="arrow-back" size={15} color={Colors.primary} /> Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isCompleted    = shipment.current_phase === 'completed';
  const carrier        = carrierName(shipment.transport_mode);
  const transportIcon  = shipment.transport_mode === 'air' ? '✈' : '🚂';
  const phaseCfg       = PHASE_CONFIG[shipment.current_phase] ?? PHASE_CONFIG.pickup;

  // Determine what action to show this employee right now
  type ActionConfig = {
    label: string;
    description: string;
    color: string;
    nextPhase: ShipmentPhase;
    confirmTitle: string;
    confirmMsg: string;
    successMsg: string;
  };

  const getAction = (): ActionConfig | null => {
    const p = shipment.current_phase;

    // Pickup employee actions
    if (isPickupEmployee && p === 'pickup') return {
      label: '📦  Mark as Picked Up',
      description: 'Confirm goods have been collected from the sender.',
      color: '#F57F17',
      nextPhase: 'transit',
      confirmTitle: 'Mark as Picked Up?',
      confirmMsg: 'Confirm that you have picked up the goods from the sender.',
      successMsg: 'Marked as picked up! Now head to the ' + carrier + '.',
    };

    if (isPickupEmployee && p === 'transit') return {
      label: `${transportIcon}  Handed to ${carrier}`,
      description: `Confirm goods have been handed over at the ${carrier}.`,
      color: '#1565C0',
      nextPhase: 'handed_to_carrier',
      confirmTitle: `Handed to ${carrier}?`,
      confirmMsg: `Confirm you have dropped the goods at the ${carrier} for onward transport.`,
      successMsg: `Goods handed to carrier at ${carrier}. Your job is complete!`,
    };

    // Delivery employee actions
    if (isDeliveryEmployee && p === 'handed_to_carrier') return {
      label: `📦  Picked Up from ${carrier}`,
      description: `Confirm you have collected the goods from the ${carrier}.`,
      color: '#6A1B9A',
      nextPhase: 'out_for_delivery',
      confirmTitle: `Picked Up from ${carrier}?`,
      confirmMsg: `Confirm you have collected the goods from the ${carrier} and are heading to deliver.`,
      successMsg: 'Great! Now head out to deliver the goods to the recipient.',
    };

    if (isDeliveryEmployee && p === 'out_for_delivery') return {
      label: '✓  Mark as Delivered',
      description: 'Confirm goods have been delivered to the recipient.',
      color: Colors.success,
      nextPhase: 'completed',
      confirmTitle: 'Mark as Delivered?',
      confirmMsg: 'Confirm that you have delivered the goods to the recipient.',
      successMsg: 'Shipment marked as delivered and completed!',
    };

    return null;
  };

  const action = getAction();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Tracking banner ───────────────────────────────────────────── */}
      {tracking && (
        <View style={styles.trackingBanner}>
          <PulsingDot color="#2E7D32" />
          <Text style={styles.trackingBannerText}>LOCATION SHARING ACTIVE</Text>
        </View>
      )}

      {/* ── Header card ──────────────────────────────────────────────── */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.trackingId}>{shipment.tracking_id}</Text>
          <View style={[styles.rolePill, isPickupEmployee && !isDeliveryEmployee ? styles.rolePillPickup : styles.rolePillDelivery]}>
            <Text style={styles.rolePillText}>
              {isPickupEmployee && !isDeliveryEmployee
                ? 'PICKUP DRIVER'
                : isDeliveryEmployee && !isPickupEmployee
                ? 'DELIVERY DRIVER'
                : 'DRIVER'}
            </Text>
          </View>
        </View>
        <View style={[styles.phasePill, { backgroundColor: phaseCfg.bg }]}>
          <Text style={[styles.phasePillText, { color: phaseCfg.text }]}>{phaseCfg.label}</Text>
        </View>
        <PhaseStepBar currentPhase={shipment.current_phase} />
      </View>

      {/* ── Your Next Action ─────────────────────────────────────────── */}
      {!isCompleted && action && (
        <View style={styles.actionCard}>
          <Text style={styles.actionCardTitle}>YOUR NEXT ACTION</Text>
          <Text style={styles.actionCardDesc}>{action.description}</Text>

          {/* GPS card if this phase requires location sharing */}
          {showGps && (
            <View style={styles.actionCardGps}>
              <GpsCard
                tracking={tracking}
                currentCoords={currentCoords}
                onToggle={tracking ? stopTracking : startTracking}
              />
            </View>
          )}

          {showGps && !tracking && (
            <Text style={styles.gpsRequiredHint}>
              ⚠  Start location sharing above before proceeding
            </Text>
          )}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: action.color },
              (transitioning || (showGps && !tracking)) && styles.actionBtnDisabled,
            ]}
            onPress={() => {
              if (showGps && !tracking) {
                Alert.alert('GPS Required', 'Start location sharing before marking this step.');
                return;
              }
              confirmTransition(action.confirmTitle, action.confirmMsg, action.nextPhase, action.successMsg);
            }}
            disabled={transitioning}
            activeOpacity={0.8}
          >
            {transitioning
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.actionBtnText}>{action.label}</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Undo Pickup (pickup driver when in transit) ──────────────── */}
      {isPickupEmployee && !isDeliveryEmployee && phase === 'transit' && !isCompleted && (
        <View style={styles.undoCard}>
          <TouchableOpacity
            style={[styles.undoBtn, transitioning && styles.actionBtnDisabled]}
            onPress={() => {
              Alert.alert(
                'Undo Pickup',
                'This will reverse the pickup and stop GPS sharing. The shipment will return to pickup phase. Continue?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Undo Pickup',
                    style: 'destructive',
                    onPress: async () => {
                      setTransitioning(true);
                      skipNextPhaseAlert.current = true;
                      stopTracking();
                      try {
                        await transitionPhase(id!, 'pickup');
                        load();
                      } catch (e: unknown) {
                        const rawDetail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
                        const msg = Array.isArray(rawDetail)
                          ? (rawDetail as { msg?: string }[]).map(d => d?.msg ?? String(d)).join(', ')
                          : (typeof rawDetail === 'string' ? rawDetail : 'Failed to update. Try again.');
                        Alert.alert('Error', msg);
                      } finally {
                        setTransitioning(false);
                      }
                    },
                  },
                ]
              );
            }}
            disabled={transitioning}
            activeOpacity={0.8}
          >
            <Text style={styles.undoBtnText}>↩  Undo Pickup</Text>
          </TouchableOpacity>
          <Text style={styles.undoHint}>Returns shipment to pickup phase and stops GPS</Text>
        </View>
      )}

      {/* ── Waiting for carrier (delivery driver, handed_to_carrier phase) */}
      {!isCompleted && !action && shipment.current_phase === 'handed_to_carrier' && !isDeliveryEmployee && (
        <View style={styles.waitCard}>
          <Text style={styles.waitIcon}>{transportIcon}</Text>
          <View>
            <Text style={styles.waitTitle}>Goods with Carrier</Text>
            <Text style={styles.waitDesc}>
              Goods are en route via {shipment.transport_mode === 'air' ? 'Air' : 'Train'} ({shipment.transport_number}). No action required.
            </Text>
          </View>
        </View>
      )}

      {/* ── Route ────────────────────────────────────────────────────── */}
      <Section title="Route">
        <View style={styles.routeRow}>
          <View style={styles.routeCity}>
            <Text style={styles.routeCityLabel}>FROM</Text>
            <Text style={styles.routeCityName}>{shipment.origin}</Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color={Colors.textSecondary} style={{ marginHorizontal: 8 }} />
          <View style={[styles.routeCity, styles.routeCityRight]}>
            <Text style={styles.routeCityLabel}>TO</Text>
            <Text style={styles.routeCityName}>{shipment.destination}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <InfoRow label={`${transportIcon} ${shipment.transport_mode === 'air' ? 'Flight' : 'Train'}`} value={shipment.transport_number} />
        {shipment.eta_date ? (
          <InfoRow label="ETA" value={formatETA(shipment.eta_date, shipment.eta_time)} />
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

      {/* ── Completed banner ─────────────────────────────────────────── */}
      {isCompleted && shipment.completed_at && (
        <View style={styles.completedBanner}>
          <Text style={styles.completedBannerIcon}>✓</Text>
          <View>
            <Text style={styles.completedBannerTitle}>Shipment Completed</Text>
            <Text style={styles.completedBannerDate}>{formatFullDate(shipment.completed_at)}</Text>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content:   { padding: 16, paddingBottom: 32 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface, padding: 24 },

  loadingLabel: { marginTop: 12, fontSize: 14, color: Colors.textSecondary },
  errorText:    { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  retryBtn:     { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginBottom: 12 },
  retryText:    { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  backLink:     { paddingVertical: 8 },
  backLinkText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },

  // Tracking banner
  trackingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E8F5E9', borderBottomWidth: 1, borderBottomColor: '#2E7D32',
    paddingVertical: 10, paddingHorizontal: 16,
    marginBottom: 12, marginHorizontal: -16, marginTop: -16,
  },
  trackingBannerText: { fontSize: 12, fontWeight: '800', color: '#2E7D32', letterSpacing: 1 },
  pulsingDot: { width: 10, height: 10, borderRadius: 5 },

  // Header card
  headerCard: { backgroundColor: Colors.darkHeader, borderRadius: 16, padding: 20, marginBottom: 16 },
  headerTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  trackingId: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1, flex: 1, marginRight: 10 },
  rolePill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  rolePillPickup:   { backgroundColor: 'rgba(255, 152, 0, 0.25)' },
  rolePillDelivery: { backgroundColor: 'rgba(76, 175, 80, 0.25)' },
  rolePillText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  phasePill:  { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  phasePillText: { fontSize: 13, fontWeight: '700' },

  // Action card (Your Next Action)
  actionCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16,
  },
  actionCardTitle: {
    fontSize: 11, fontWeight: '800', color: Colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6,
  },
  actionCardDesc:  { fontSize: 14, color: Colors.textSecondary, marginBottom: 14, lineHeight: 20 },
  actionCardGps:   { marginBottom: 14 },
  actionBtn: {
    height: 56, borderRadius: 12, justifyContent: 'center',
    alignItems: 'center', width: '100%',
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  gpsRequiredHint: { fontSize: 12, color: Colors.warning, fontWeight: '600', marginBottom: 10, textAlign: 'center' },

  // Undo pickup
  undoCard: {
    marginBottom: 16,
  },
  undoBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  undoBtnText: {
    color: Colors.error,
    fontWeight: '700',
    fontSize: 14,
  },
  undoHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },

  // Wait card
  waitCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#F3E5F5', borderRadius: 12,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#CE93D8',
  },
  waitIcon:  { fontSize: 32 },
  waitTitle: { fontSize: 15, fontWeight: '700', color: '#4A148C', marginBottom: 4 },
  waitDesc:  { fontSize: 13, color: '#6A1B9A', lineHeight: 18 },

  // Section
  section:      { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },

  // Route
  routeRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  routeCity:      { flex: 1 },
  routeCityRight: { alignItems: 'flex-end' },
  routeCityLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 4 },
  routeCityName:  { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  routeArrow:     { fontSize: 22, color: Colors.primary, paddingHorizontal: 12, fontWeight: '300' },
  divider:        { height: 1, backgroundColor: Colors.border, marginBottom: 12 },

  // Info row
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', flex: 1 },
  infoValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600', flex: 2, textAlign: 'right' },

  // Completed banner
  completedBanner:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16, gap: 14, marginBottom: 16 },
  completedBannerIcon:  { fontSize: 28, color: Colors.success },
  completedBannerTitle: { fontSize: 15, fontWeight: '700', color: Colors.success, marginBottom: 2 },
  completedBannerDate:  { fontSize: 13, color: Colors.textSecondary },
});
