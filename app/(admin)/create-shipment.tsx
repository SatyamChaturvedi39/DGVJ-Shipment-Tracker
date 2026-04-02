import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { createShipment, getEmployees, getCustomers } from '@/services/api';
import type { User } from '@/types';

// ─── Segmented toggle ────────────────────────────────────────────────────────

function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={seg.container}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[seg.btn, opt.value === value && seg.btnActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.8}
        >
          <Text style={[seg.label, opt.value === value && seg.labelActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const seg = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  labelActive: {
    color: '#FFFFFF',
  },
});

// ─── Field label ─────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

// ─── Inline text input ───────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        style={[
          styles.textInput,
          multiline && styles.textInputMulti,
          error ? styles.textInputError : undefined,
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ─── Dropdown picker (single select) ────────────────────────────────────────

function DropdownPicker({
  label,
  placeholder,
  value,
  options,
  onSelect,
  error,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  options: { id: string; label: string; sub?: string }[];
  onSelect: (id: string | null) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value);

  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <TouchableOpacity
        style={[styles.dropdownBtn, error ? styles.textInputError : undefined]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.dropdownBtnText, !selected && styles.dropdownPlaceholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.dropdownChevron}>▾</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{label}</Text>
          <FlatList
            data={[{ id: '', label: '— None —', sub: undefined }, ...options]}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, item.id === (value ?? '') && styles.modalItemSelected]}
                onPress={() => { onSelect(item.id || null); setOpen(false); }}
              >
                <View>
                  <Text style={[styles.modalItemText, item.id === (value ?? '') && styles.modalItemTextSelected]}>
                    {item.label}
                  </Text>
                  {item.sub ? <Text style={styles.modalItemSub}>{item.sub}</Text> : null}
                </View>
                {item.id === (value ?? '') && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

// ─── Multi-select picker ─────────────────────────────────────────────────────

function MultiSelectPicker({
  label,
  placeholder,
  values,
  options,
  onToggle,
}: {
  label: string;
  placeholder: string;
  values: string[];
  options: { id: string; label: string; sub?: string }[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabels = options.filter(o => values.includes(o.id)).map(o => o.label);

  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.dropdownBtnText, selectedLabels.length === 0 && styles.dropdownPlaceholder]} numberOfLines={1}>
          {selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}
        </Text>
        <Text style={styles.dropdownChevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{label}</Text>
          <FlatList
            data={options}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const checked = values.includes(item.id);
              return (
                <TouchableOpacity style={styles.modalItem} onPress={() => onToggle(item.id)}>
                  <View style={styles.checkboxRow}>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalItemText}>{item.label}</Text>
                      {item.sub ? <Text style={styles.modalItemSub}>{item.sub}</Text> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setOpen(false)}>
            <Text style={styles.modalDoneText}>Done ({values.length} selected)</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

interface FormErrors {
  origin?: string;
  destination?: string;
  transport_number?: string;
  eta_date?: string;
}

export default function CreateShipment() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form state
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [goodsDescription, setGoodsDescription] = useState('');
  const [transportMode, setTransportMode] = useState<'train' | 'air'>('train');
  const [transportNumber, setTransportNumber] = useState('');
  const [etaDate, setEtaDate] = useState('');
  const [etaTime, setEtaTime] = useState('');
  const [pickupEmployeeId, setPickupEmployeeId] = useState<string | null>(null);
  const [deliveryEmployeeId, setDeliveryEmployeeId] = useState<string | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [emps, custs] = await Promise.all([getEmployees(), getCustomers()]);
      setEmployees(emps);
      setCustomers(custs);
    } catch {
      // Continue without lists — fields will just be empty
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const employeeOptions = employees.map(e => ({ id: e.id, label: e.name, sub: e.phone }));
  const customerOptions = customers.map(c => ({
    id: c.id,
    label: c.name,
    sub: c.company_name ?? c.phone,
  }));

  const toggleCustomer = (id: string) => {
    setSelectedCustomerIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!origin.trim()) e.origin = 'Origin is required';
    if (!destination.trim()) e.destination = 'Destination is required';
    if (!transportNumber.trim()) e.transport_number = 'Transport number is required';
    if (etaDate && !/^\d{4}-\d{2}-\d{2}$/.test(etaDate)) e.eta_date = 'Use format YYYY-MM-DD';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await createShipment({
        origin: origin.trim(),
        destination: destination.trim(),
        goods_description: goodsDescription.trim() || undefined,
        transport_mode: transportMode,
        transport_number: transportNumber.trim(),
        eta_date: etaDate.trim() || undefined,
        eta_time: etaTime.trim() || undefined,
        pickup_employee_id: pickupEmployeeId ?? undefined,
        delivery_employee_id: deliveryEmployeeId ?? undefined,
        notes: notes.trim() || undefined,
        customer_ids: selectedCustomerIds,
      });
      Alert.alert('Shipment Created', 'The new shipment has been created successfully.', [
        { text: 'OK', onPress: () => router.replace('/(admin)/dashboard') },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Failed to create shipment. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Route */}
        <Text style={styles.section}>Route</Text>
        <Field
          label="Origin City"
          value={origin}
          onChange={setOrigin}
          placeholder="e.g. Bengaluru"
          error={errors.origin}
        />
        <Field
          label="Destination City"
          value={destination}
          onChange={setDestination}
          placeholder="e.g. Mumbai"
          error={errors.destination}
        />

        {/* Goods */}
        <Text style={styles.section}>Goods</Text>
        <Field
          label="Goods Description (optional)"
          value={goodsDescription}
          onChange={setGoodsDescription}
          placeholder="e.g. Electronic components"
        />

        {/* Transport */}
        <Text style={styles.section}>Transport</Text>
        <FieldLabel>Mode</FieldLabel>
        <SegmentedToggle
          options={[
            { label: '🚂  Train', value: 'train' },
            { label: '✈  Air', value: 'air' },
          ]}
          value={transportMode}
          onChange={v => setTransportMode(v as 'train' | 'air')}
        />
        <Field
          label="Transport Number"
          value={transportNumber}
          onChange={setTransportNumber}
          placeholder={transportMode === 'train' ? 'e.g. 12627' : 'e.g. 6E-204'}
          error={errors.transport_number}
        />

        {/* ETA */}
        <Text style={styles.section}>ETA</Text>
        <Field
          label="ETA Date"
          value={etaDate}
          onChange={setEtaDate}
          placeholder="YYYY-MM-DD"
          hint="Format: YYYY-MM-DD"
          error={errors.eta_date}
        />
        <Field
          label="ETA Time (optional)"
          value={etaTime}
          onChange={setEtaTime}
          placeholder="HH:MM"
          hint="Format: HH:MM (24h)"
        />

        {/* Assignment */}
        <Text style={styles.section}>Assignment</Text>
        <DropdownPicker
          label="Pickup Employee"
          placeholder="Select pickup driver"
          value={pickupEmployeeId}
          options={employeeOptions}
          onSelect={setPickupEmployeeId}
        />
        <DropdownPicker
          label="Delivery Employee"
          placeholder="Select delivery driver"
          value={deliveryEmployeeId}
          options={employeeOptions}
          onSelect={setDeliveryEmployeeId}
        />
        <MultiSelectPicker
          label="Assign Customers"
          placeholder="Select customers who can track"
          values={selectedCustomerIds}
          options={customerOptions}
          onToggle={toggleCustomer}
        />

        {/* Notes */}
        <Text style={styles.section}>Notes</Text>
        <Field
          label="Internal Notes (optional)"
          value={notes}
          onChange={setNotes}
          placeholder="Any special instructions…"
          multiline
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Create Shipment</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },

  section: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 12,
  },
  fieldWrap: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  textInputMulti: {
    height: 88,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  textInputError: {
    borderColor: Colors.error,
  },
  fieldError: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },

  // Dropdown
  dropdownBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownBtnText: {
    fontSize: 16,
    color: Colors.textPrimary,
    flex: 1,
  },
  dropdownPlaceholder: {
    color: Colors.textMuted,
  },
  dropdownChevron: {
    fontSize: 16,
    color: Colors.textMuted,
    marginLeft: 8,
  },

  // Modal sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 4,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  modalItemSelected: {
    backgroundColor: '#FFF5F5',
  },
  modalItemText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  modalItemTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  modalItemSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '700',
  },

  // Multi-select checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalDoneBtn: {
    margin: 16,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDoneText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },

  // Submit
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
