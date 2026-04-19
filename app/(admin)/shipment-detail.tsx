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
import { getShipment, getEmployees, getCustomers, addStatusEvent, transitionPhase, updateShipment } from '@/services/api';
import { formatEventDate, formatETA, formatFullDate } from '@/utils/formatDate';
import type { ShipmentDetail, StatusEvent, User, ShipmentPhase } from '@/types';

// ─── Phase rail ───────────────────────────────────────────────────────────────

function PhaseRail({
  current,
  onSelect,
  disabled,
}: {
  current: ShipmentPhase;
  onSelect: (phase: ShipmentPhase) => void;
  disabled: boolean;
}) {
  const currentIdx = PHASE_ORDER.indexOf(current);
  return (
    <View style={rail.wrap}>
      <Text style={rail.label}>Set Phase</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rail.scroll}>
        {PHASE_ORDER.map((phase, idx) => {
          const cfg = PHASE_CONFIG[phase];
          const isActive = phase === current;
          const isPast   = idx < currentIdx;
          return (
            <TouchableOpacity
              key={phase}
              style={[
                rail.pill,
                isActive ? { backgroundColor: cfg.bg, borderColor: cfg.text } : rail.pillInactive,
                isPast && rail.pillPast,
              ]}
              onPress={() => !isActive && !disabled && onSelect(phase)}
              activeOpacity={isActive ? 1 : 0.7}
              disabled={isActive || disabled}
            >
              <Text style={[
                rail.pillText,
                isActive ? { color: cfg.text, fontWeight: '700' } : rail.pillTextInactive,
              ]}>
                {cfg.label}
              </Text>
              {isActive && <View style={[rail.activeDot, { backgroundColor: cfg.text }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const rail = StyleSheet.create({
  wrap:            { marginBottom: 10 },
  label:           { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  scroll:          { gap: 8, paddingRight: 4 },
  pill:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  pillInactive:    { backgroundColor: '#F8F9FA', borderColor: '#E0E0E0' },
  pillPast:        { opacity: 0.55 },
  pillText:        { fontSize: 12 },
  pillTextInactive:{ color: Colors.textSecondary, fontWeight: '500' },
  activeDot:       { width: 6, height: 6, borderRadius: 3 },
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
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
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
          {event.is_completed ? formatEventDate(event.timestamp) : 'Pending'}
        </Text>
      </View>
    </View>
  );
}

const tl = StyleSheet.create({
  row:          { flexDirection: 'row', marginBottom: 0 },
  left:         { width: 30, alignItems: 'center' },
  dot:          { width: 18, height: 18, borderRadius: 9, marginTop: 2, justifyContent: 'center', alignItems: 'center' },
  dotDone:      { backgroundColor: Colors.primary },
  dotCheck:     { color: '#FFF', fontSize: 10, fontWeight: '800' },
  dotCurrent:   { borderWidth: 2, borderColor: Colors.primary, backgroundColor: 'transparent' },
  dotPending:   { borderWidth: 2, borderColor: Colors.border, backgroundColor: 'transparent' },
  line:         { flex: 1, width: 2, marginVertical: 3 },
  lineDone:     { backgroundColor: Colors.primary },
  linePending:  { backgroundColor: Colors.border },
  content:      { flex: 1, paddingBottom: 22, paddingLeft: 10 },
  label:        { fontSize: 14, fontWeight: '600' },
  labelDone:    { color: Colors.textPrimary },
  labelPending: { color: Colors.textSecondary },
  desc:         { fontSize: 13, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  time:         { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
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
  const [desc, setDesc]   = useState('');
  const [err, setErr]     = useState('');

  const reset = () => { setLabel(''); setDesc(''); setErr(''); };
  const handleClose  = () => { reset(); onClose(); };
  const handleSubmit = () => {
    if (!label.trim()) { setErr('Status label is required'); return; }
    onSubmit(label.trim(), desc.trim());
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <TouchableOpacity style={md.backdrop} activeOpacity={1} onPress={handleClose} />
      <View style={md.sheet}>
        <View style={md.handle} />
        <Text style={md.title}>Add Status Update</Text>
        <View style={md.body}>
          <Text style={md.fieldLabel}>Status Label *</Text>
          <TextInput
            style={[md.input, err ? md.inputError : undefined]}
            value={label}
            onChangeText={v => { setLabel(v); setErr(''); }}
            placeholder="e.g. Arrived at Mumbai airport"
            placeholderTextColor={Colors.textMuted}
          />
          {err ? <Text style={md.errText}>{err}</Text> : null}

          <Text style={[md.fieldLabel, { marginTop: 14 }]}>Description (optional)</Text>
          <TextInput
            style={[md.input, md.inputMulti]}
            value={desc}
            onChangeText={setDesc}
            placeholder="Additional details…"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>
        <TouchableOpacity
          style={[md.submitBtn, submitting && md.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#FFF" />
            : <Text style={md.submitText}>Add Update</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const md = StyleSheet.create({
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
  submitText:    { color: '#FFF', fontWeight: '700', fontSize: 16 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [shipment, setShipment]         = useState<ShipmentDetail | null>(null);
  const [employees, setEmployees]       = useState<User[]>([]);
  const [customerMap, setCustomerMap]   = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [settingPhase, setSettingPhase]       = useState(false);
  const [addStatusVisible, setAddVis]         = useState(false);
  const [addingStatus, setAddingStatus]       = useState(false);
  const [editingTrackId, setEditingTrackId]   = useState(false);
  const [trackIdDraft, setTrackIdDraft]       = useState('');
  const [savingTrackId, setSavingTrackId]     = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, emps, customers] = await Promise.all([getShipment(id), getEmployees(), getCustomers()]);
      setShipment(detail);
      setEmployees(emps);
      setCustomerMap(Object.fromEntries(customers.map(c => [c.id, c.name ?? c.phone])));
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

  const handleSaveTrackingId = async () => {
    const trimmed = trackIdDraft.trim().toUpperCase();
    if (!trimmed) { Alert.alert('Error', 'Tracking ID cannot be empty.'); return; }
    setSavingTrackId(true);
    try {
      await updateShipment(id!, { tracking_id: trimmed });
      await load();
      setEditingTrackId(false);
    } catch {
      Alert.alert('Error', 'Failed to update tracking ID. Try again.');
    } finally {
      setSavingTrackId(false);
    }
  };

  const handleSetPhase = (targetPhase: ShipmentPhase) => {
    if (!shipment) return;
    const currentIdx = PHASE_ORDER.indexOf(shipment.current_phase);
    const targetIdx  = PHASE_ORDER.indexOf(targetPhase);
    const isBackward = targetIdx < currentIdx;

    const label = PHASE_CONFIG[targetPhase].label;
    const msg   = isBackward
      ? `⚠️ This will reverse the shipment to "${label}". Status events will be updated to match. Continue?`
      : `Move this shipment to "${label}"?`;

    Alert.alert('Change Phase', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isBackward ? 'Reverse' : 'Confirm',
        style: isBackward ? 'destructive' : 'default',
        onPress: async () => {
          setSettingPhase(true);
          try {
            await transitionPhase(shipment.id, targetPhase);
            await load();
          } catch {
            Alert.alert('Error', 'Failed to change phase. Please try again.');
          } finally {
            setSettingPhase(false);
          }
        },
      },
    ]);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingLabel}>Loading shipment…</Text>
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
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* ── Dark header card ──────────────────────────────────── */}
        <View style={styles.headerCard}>
          {editingTrackId ? (
            <View style={styles.trackIdEditRow}>
              <TextInput
                style={styles.trackIdInput}
                value={trackIdDraft}
                onChangeText={setTrackIdDraft}
                autoCapitalize="characters"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveTrackingId}
              />
              <TouchableOpacity
                style={[styles.trackIdSaveBtn, savingTrackId && { opacity: 0.6 }]}
                onPress={handleSaveTrackingId}
                disabled={savingTrackId}
              >
                {savingTrackId
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.trackIdSaveBtnText}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.trackIdCancelBtn}
                onPress={() => setEditingTrackId(false)}
              >
                <Text style={styles.trackIdCancelText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => { setTrackIdDraft(shipment.tracking_id); setEditingTrackId(true); }}
              activeOpacity={0.75}
              style={styles.trackIdTapArea}
            >
              <Text style={styles.trackingId}>{shipment.tracking_id}</Text>
              <Text style={styles.trackIdEditHint}>✏  Tap to edit</Text>
            </TouchableOpacity>
          )}
          <View style={styles.headerMeta}>
            {(() => {
              const cfg = PHASE_CONFIG[shipment.current_phase] ?? PHASE_CONFIG.pickup;
              return (
                <View style={[styles.phaseBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.phaseBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
              );
            })()}
            <View style={styles.modePill}>
              <Text style={styles.modePillText}>
                {shipment.transport_mode === 'air' ? '✈  Air' : '🚂  Train'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Phase rail (admin arbitrary control) ──────────────── */}
        <View style={styles.actionsCard}>
          <PhaseRail
            current={shipment.current_phase}
            onSelect={handleSetPhase}
            disabled={settingPhase}
          />
          {settingPhase && (
            <View style={styles.settingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.settingText}>Updating phase…</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.addStatusBtn}
            onPress={() => setAddVis(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addStatusBtnText}>+ Add Status Update</Text>
          </TouchableOpacity>
        </View>

        {/* ── Route ────────────────────────────────────────────── */}
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

        {/* ── Goods ────────────────────────────────────────────── */}
        {(shipment.goods_description || shipment.notes) && (
          <Section title="Goods">
            {shipment.goods_description && <InfoRow label="Description" value={shipment.goods_description} />}
            {shipment.notes             && <InfoRow label="Notes"       value={shipment.notes} />}
          </Section>
        )}

        {/* ── Status timeline (system events, sort_order 1–6) ──── */}
        {(() => {
          const systemEvents = shipment.status_events?.filter(e => !e.sort_order || e.sort_order <= 6) ?? [];
          const adminNotes   = shipment.status_events?.filter(e => e.sort_order != null && e.sort_order > 6) ?? [];
          return (
            <>
              {systemEvents.length > 0 && (
                <Section title="Status Timeline">
                  {systemEvents.map((ev, idx) => {
                    const firstPending = systemEvents.findIndex(e => !e.is_completed);
                    const isCurrent    = !ev.is_completed && idx === firstPending;
                    return (
                      <TimelineItem
                        key={ev.id}
                        event={ev}
                        isLast={idx === systemEvents.length - 1}
                        isCurrent={isCurrent}
                      />
                    );
                  })}
                </Section>
              )}
              {adminNotes.length > 0 && (
                <Section title="Admin Updates">
                  <View style={styles.adminNotesCard}>
                    {adminNotes.map((note, idx) => (
                      <View key={note.id} style={[styles.adminNoteRow, idx > 0 && styles.adminNoteRowBorder]}>
                        <Text style={styles.adminNoteLabel}>{note.label}</Text>
                        {note.description ? <Text style={styles.adminNoteDesc}>{note.description}</Text> : null}
                        <Text style={styles.adminNoteTime}>{formatEventDate(note.timestamp)}</Text>
                      </View>
                    ))}
                  </View>
                </Section>
              )}
            </>
          );
        })()}

        {/* ── Employees ────────────────────────────────────────── */}
        <Section title="Assigned Employees">
          <InfoRow label="Pickup Driver"   value={employeeName(shipment.pickup_employee_id)} />
          <InfoRow label="Delivery Driver" value={employeeName(shipment.delivery_employee_id)} />
        </Section>

        {/* ── Customers ────────────────────────────────────────── */}
        {shipment.customer_ids?.length > 0 && (
          <Section title="Customers with Access">
            {shipment.customer_ids.map(cid => (
              <View key={cid} style={styles.customerRow}>
                <View style={styles.customerDot} />
                <Text style={styles.customerName}>{customerMap[cid] ?? cid}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* ── Completed banner ─────────────────────────────────── */}
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
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content:   { padding: 16, paddingBottom: 32 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 24 },

  loadingLabel: { marginTop: 12, fontSize: 14, color: Colors.textSecondary },
  errorText:    { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  retryBtn:     { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginBottom: 12 },
  retryText:    { color: '#FFF', fontWeight: '700', fontSize: 15 },
  backLink:     { paddingVertical: 8 },
  backLinkText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },

  // Header card
  headerCard:     { backgroundColor: Colors.darkHeader, borderRadius: 16, padding: 20, marginBottom: 12 },
  trackingId:     { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  trackIdTapArea: { marginBottom: 14 },
  trackIdEditHint:{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: '500' },
  trackIdEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  trackIdInput:   { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 17, fontWeight: '700', color: '#FFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  trackIdSaveBtn: { backgroundColor: Colors.success, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  trackIdSaveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  trackIdCancelBtn:   { padding: 8 },
  trackIdCancelText:  { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '700' },
  headerMeta:     { flexDirection: 'row', gap: 10, alignItems: 'center' },
  phaseBadge:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  phaseBadgeText: { fontSize: 13, fontWeight: '700' },
  modePill:       { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  modePillText:   { color: '#FFF', fontSize: 13, fontWeight: '600' },

  // Actions card
  actionsCard:    { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E8E8E8', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  settingRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  settingText:    { fontSize: 13, color: Colors.textSecondary },
  addStatusBtn:   { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  addStatusBtnText:{ color: Colors.primary, fontWeight: '700', fontSize: 15 },

  // Section
  section:      { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 4 },
  sectionCard:  { backgroundColor: '#FFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E8E8E8', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },

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

  // Admin notes card
  adminNotesCard:     { backgroundColor: '#FFFDE7', borderRadius: 10, borderWidth: 1, borderColor: '#FFE082', overflow: 'hidden' },
  adminNoteRow:       { paddingHorizontal: 14, paddingVertical: 10 },
  adminNoteRowBorder: { borderTopWidth: 1, borderTopColor: '#FFE082' },
  adminNoteLabel:     { fontSize: 14, fontWeight: '700', color: '#5D4037', marginBottom: 2 },
  adminNoteDesc:      { fontSize: 13, color: '#795548', marginBottom: 4 },
  adminNoteTime:      { fontSize: 11, color: '#A1887F' },

  // Completed banner
  completedBanner:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', borderRadius: 14, padding: 16, gap: 14, marginBottom: 16, borderWidth: 1, borderColor: '#A5D6A7' },
  completedIcon:     { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.success, justifyContent: 'center', alignItems: 'center' },
  completedIconText: { fontSize: 18, color: '#FFF', fontWeight: '800' },
  completedTitle:    { fontSize: 15, fontWeight: '700', color: Colors.success, marginBottom: 2 },
  completedDate:     { fontSize: 13, color: Colors.textSecondary },
});
