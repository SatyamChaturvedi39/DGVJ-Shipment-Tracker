import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { PHASE_CONFIG, PHASE_ORDER } from '@/constants/phases';
import { getShipment, getEmployees, addStatusEvent, transitionPhase } from '@/services/api';
import { formatEventDate, formatETA, formatFullDate } from '@/utils/formatDate';
import type { ShipmentDetail, StatusEvent, User, ShipmentPhase } from '@/types';

const ADVANCE_LABEL: Partial<Record<ShipmentPhase, string>> = {
  pickup:            'Mark as In Transit  →',
  transit:           'Mark as Handed to Carrier  →',
  handed_to_carrier: 'Mark as Out for Delivery  →',
  out_for_delivery:  'Mark as Delivered  ✓',
};

function getNextPhase(current: ShipmentPhase): ShipmentPhase | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

function PhaseBadge({ phase }: { phase: ShipmentPhase }) {
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.pickup;
  return (
    <View style={[badge.container, { backgroundColor: cfg.bg }]}>
      <Text style={[badge.text, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  container: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  text:      { fontSize: 13, fontWeight: '700' },
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

function TimelineItem({
  event, isLast, isCurrent,
}: {
  event: StatusEvent;
  isLast: boolean;
  isCurrent: boolean;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isCurrent) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isCurrent, pulse]);

  return (
    <View style={tl.row}>
      <View style={tl.left}>
        {event.is_completed ? (
          <View style={[tl.dot, tl.dotDone]}>
            <Text style={tl.dotCheck}>✓</Text>
          </View>
        ) : isCurrent ? (
          <Animated.View style={[tl.dot, tl.dotCurrent, { opacity: pulse }]} />
        ) : (
          <View style={[tl.dot, tl.dotPending]} />
        )}
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
  left:        { width: 30, alignItems: 'center' },
  dot:         { width: 18, height: 18, borderRadius: 9, marginTop: 2, justifyContent: 'center', alignItems: 'center' },
  dotDone:     { backgroundColor: Colors.primary },
  dotCheck:    { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  dotCurrent:  { borderWidth: 2, borderColor: Colors.primary, backgroundColor: 'transparent' },
  dotPending:  { borderWidth: 2, borderColor: Colors.border, backgroundColor: 'transparent' },
  line:        { flex: 1, width: 2, marginVertical: 3 },
  lineDone:    { backgroundColor: Colors.primary },
  linePending: { backgroundColor: Colors.border },
  content:     { flex: 1, paddingBottom: 22, paddingLeft: 10 },
  label:       { fontSize: 14, fontWeight: '600' },
  labelDone:   { color: Colors.textPrimary },
  labelPending:{ color: Colors.textSecondary },
  desc:        { fontSize: 13, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  time:        { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
});

// ─── Add status event modal ───────────────────────────────────────────────────

function AddStatusModal({
  visible, onClose, onSubmit, submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (label: string, desc: string) => void;
  submitting: boolean;
}) {
  const [label, setLabel] = useState('');
  const [desc,  setDesc]  = useState('');
  const [err,   setErr]   = useState('');

  const reset = () => { setLabel(''); setDesc(''); setErr(''); };
  const handleClose  = () => { reset(); onClose(); };
  const handleSubmit = () => {
    if (!label.trim()) { setErr('Status label is required'); return; }
    onSubmit(label.trim(), desc.trim());
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <TouchableOpacity style={modal.backdrop} activeOpacity={1} onPress={handleClose} />
      <View style={modal.sheet}>
        <View style={modal.handle} />
        <Text style={modal.title}>Add Status Update</Text>
        <View style={modal.body}>
          <Text style={modal.fieldLabel}>Status Label *</Text>
          <TextInput
            style={[modal.input, err ? modal.inputError : undefined]}
            value={label}
            onChangeText={v => { setLabel(v); setErr(''); }}
            placeholder="e.g. Arrived at Mumbai airport"
            placeholderTextColor={Colors.textMuted}
          />
          {err ? <Text style={modal.errText}>{err}</Text> : null}

          <Text style={[modal.fieldLabel, { marginTop: 14 }]}>Description (optional)</Text>
          <TextInput
            style={[modal.input, modal.inputMulti]}
            value={desc}
            onChangeText={setDesc}
            placeholder="Additional details…"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>
        <TouchableOpacity
          style={[modal.submitBtn, submitting && modal.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={modal.submitText}>Add Update</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const modal = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:         { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36 },
  handle:        { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  title:         { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  body:          { padding: 20 },
  fieldLabel:    { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input:         { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, height: 52, paddingHorizontal: 16, fontSize: 15, color: Colors.textPrimary },
  inputMulti:    { height: 88, paddingTop: 14, textAlignVertical: 'top' },
  inputError:    { borderColor: Colors.error },
  errText:       { fontSize: 12, color: Colors.error, marginTop: 4 },
  submitBtn:     { marginHorizontal: 20, backgroundColor: Colors.primary, borderRadius: 12, height: 52, justifyContent: 'center', alignItems: 'center' },
  submitDisabled:{ opacity: 0.6 },
  submitText:    { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [shipment, setShipment]         = useState<ShipmentDetail | null>(null);
  const [employees, setEmployees]       = useState<User[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [advancingPhase, setAdvancing]  = useState(false);
  const [addStatusVisible, setAddVis]   = useState(false);
  const [addingStatus, setAddingStatus] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, emps] = await Promise.all([getShipment(id), getEmployees()]);
      setShipment(detail);
      setEmployees(emps);
    } catch {
      setError('Could not load shipment details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const employeeName = (empId: string | null): string => {
    if (!empId) return '—';
    return employees.find(e => e.id === empId)?.name ?? empId;
  };

  const handleAdvancePhase = async () => {
    if (!shipment) return;
    const next = getNextPhase(shipment.current_phase);
    if (!next) return;
    Alert.alert(
      'Advance Phase',
      `Move this shipment to "${PHASE_CONFIG[next].label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setAdvancing(true);
            try {
              await transitionPhase(shipment.id, next);
              await load();
            } catch {
              Alert.alert('Error', 'Failed to advance phase. Please try again.');
            } finally {
              setAdvancing(false);
            }
          },
        },
      ]
    );
  };

  const handleAddStatus = async (label: string, desc: string) => {
    if (!shipment) return;
    setAddingStatus(true);
    try {
      await addStatusEvent(shipment.id, { label, description: desc || undefined });
      setAddVis(false);
      await load();
    } catch {
      Alert.alert('Error', 'Failed to add status update.');
    } finally {
      setAddingStatus(false);
    }
  };

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingLabel}>Loading shipment...</Text>
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

  const nextPhase    = getNextPhase(shipment.current_phase);
  const isCompleted  = shipment.current_phase === 'completed';
  const advanceLabel = ADVANCE_LABEL[shipment.current_phase] ?? 'Advance Phase →';

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* ── Header card ──────────────────────────────────────────── */}
        <View style={styles.headerCard}>
          <Text style={styles.trackingId}>{shipment.tracking_id}</Text>
          <View style={styles.headerMeta}>
            <PhaseBadge phase={shipment.current_phase} />
            <View style={styles.modePill}>
              <Text style={styles.modePillText}>
                {shipment.transport_mode === 'air' ? '✈  Air' : '🚂  Train'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Route ────────────────────────────────────────────────── */}
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
          <InfoRow label="Transport #" value={shipment.transport_number} />
          <InfoRow
            label="ETA"
            value={shipment.eta_date ? formatETA(shipment.eta_date, shipment.eta_time) : null}
          />
        </Section>

        {/* ── Goods ────────────────────────────────────────────────── */}
        {(shipment.goods_description || shipment.notes) && (
          <Section title="Goods">
            {shipment.goods_description && <InfoRow label="Description" value={shipment.goods_description} />}
            {shipment.notes             && <InfoRow label="Notes"       value={shipment.notes} />}
          </Section>
        )}

        {/* ── Status timeline ──────────────────────────────────────── */}
        {shipment.status_events?.length > 0 && (
          <Section title="Status Timeline">
            {shipment.status_events.map((ev, idx) => {
              const firstPending = shipment.status_events.findIndex(e => !e.is_completed);
              const isCurrent    = !ev.is_completed && idx === firstPending;
              return (
                <TimelineItem
                  key={ev.id}
                  event={ev}
                  isLast={idx === shipment.status_events.length - 1}
                  isCurrent={isCurrent}
                />
              );
            })}
          </Section>
        )}

        {/* ── Employees ────────────────────────────────────────────── */}
        <Section title="Assigned Employees">
          <InfoRow label="Pickup Driver"   value={employeeName(shipment.pickup_employee_id)} />
          <InfoRow label="Delivery Driver" value={employeeName(shipment.delivery_employee_id)} />
        </Section>

        {/* ── Customers ────────────────────────────────────────────── */}
        {shipment.customer_ids?.length > 0 && (
          <Section title="Customers with Access">
            {shipment.customer_ids.map(cid => (
              <View key={cid} style={styles.customerRow}>
                <View style={styles.customerDot} />
                <Text style={styles.customerName}>{cid}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* ── Completed banner ─────────────────────────────────────── */}
        {isCompleted && shipment.completed_at && (
          <View style={styles.completedBanner}>
            <View style={styles.completedIcon}>
              <Text style={styles.completedIconText}>✓</Text>
            </View>
            <View>
              <Text style={styles.completedTitle}>Shipment Completed</Text>
              <Text style={styles.completedDate}>{formatFullDate(shipment.completed_at)}</Text>
            </View>
          </View>
        )}

        {/* ── Admin actions ─────────────────────────────────────────── */}
        {!isCompleted && (
          <View style={styles.actionsSection}>
            <Text style={styles.actionsSectionTitle}>Admin Actions</Text>

            {nextPhase && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary, advancingPhase && styles.actionBtnDisabled]}
                onPress={handleAdvancePhase}
                disabled={advancingPhase}
                activeOpacity={0.8}
              >
                {advancingPhase
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.actionBtnText}>{advanceLabel}</Text>}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              onPress={() => setAddVis(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnOutlineText}>+ Add Status Update</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddStatusModal
        visible={addStatusVisible}
        onClose={() => setAddVis(false)}
        onSubmit={handleAddStatus}
        submitting={addingStatus}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content:   { padding: 16, paddingBottom: 32 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface, padding: 24 },

  loadingLabel: { marginTop: 12, fontSize: 14, color: Colors.textSecondary },
  errorText:    { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  retryBtn:     { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginBottom: 12 },
  retryText:    { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  backLink:     { paddingVertical: 8 },
  backLinkText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },

  // Header card
  headerCard:   { backgroundColor: Colors.darkHeader, borderRadius: 16, padding: 20, marginBottom: 16 },
  trackingId:   { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1, marginBottom: 14 },
  headerMeta:   { flexDirection: 'row', gap: 10, alignItems: 'center' },
  modePill:     { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  modePillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Section
  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 4 },
  sectionCard:  { backgroundColor: Colors.surfaceElevated, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },

  // Route
  routeRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  routeCity:      { flex: 1 },
  routeCityRight: { alignItems: 'flex-end' },
  routeCityLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 4 },
  routeCityName:  { fontSize: 19, fontWeight: '700', color: Colors.textPrimary },
  routeArrow:     { fontSize: 22, color: Colors.primary, paddingHorizontal: 12 },
  divider:        { height: 1, backgroundColor: Colors.border, marginBottom: 12 },

  // Info row
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 7 },
  infoLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', flex: 1 },
  infoValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600', flex: 2, textAlign: 'right' },

  // Customers
  customerRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  customerDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  customerName: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },

  // Completed banner
  completedBanner:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', borderRadius: 14, padding: 16, gap: 14, marginBottom: 16, borderWidth: 1, borderColor: '#A5D6A7' },
  completedIcon:     { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.success, justifyContent: 'center', alignItems: 'center' },
  completedIconText: { fontSize: 18, color: '#FFFFFF', fontWeight: '800' },
  completedTitle:    { fontSize: 15, fontWeight: '700', color: Colors.success, marginBottom: 2 },
  completedDate:     { fontSize: 13, color: Colors.textSecondary },

  // Actions
  actionsSection:      { marginTop: 4, marginBottom: 16 },
  actionsSectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, paddingHorizontal: 4 },
  actionBtn:           { borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionBtnPrimary:    { backgroundColor: Colors.primary },
  actionBtnOutline:    { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  actionBtnDisabled:   { opacity: 0.6 },
  actionBtnText:       { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  actionBtnOutlineText:{ color: Colors.primary, fontWeight: '700', fontSize: 16 },
});
