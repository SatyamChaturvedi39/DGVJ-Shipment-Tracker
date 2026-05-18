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
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { getShipments } from '@/services/api';
import { formatETA } from '@/utils/formatDate';
import { useAuth } from '@/hooks/useAuth';
import type { Shipment, ShipmentPhase, TransportMode } from '@/types';

const PHASE_CONFIG: Record<ShipmentPhase, { color: string; label: string }> = {
  pickup: { color: '#f59e0b', label: '📦 Driver heading to pickup' },
  transit: { color: '#3b82f6', label: '🚗 Heading to terminal' },
  handed_to_carrier: { color: '#8b5cf6', label: '✈ In transit via carrier' },
  out_for_delivery: { color: '#f59e0b', label: '🛵 Out for delivery' },
  completed: { color: '#10b981', label: '✓ Successfully Delivered' },
};

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const config = PHASE_CONFIG[shipment.current_phase] || PHASE_CONFIG.pickup;
  const isCompleted = shipment.current_phase === 'completed';

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: config.color }]}
      activeOpacity={0.7}
      onPress={() => router.push(`/(customer)/shipment-tracking?id=${shipment.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.trackingIdBadge}>
          <Text style={styles.trackingIdText}>{shipment.tracking_id}</Text>
        </View>
        <Ionicons
          name={shipment.transport_mode === 'air' ? 'airplane-outline' : 'train-outline'}
          size={16}
          color="#94a3b8"
        />
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <Text style={styles.routeLabel}>From</Text>
          <Text style={styles.cityName}>{shipment.origin}</Text>
        </View>
        <View style={styles.routeArrow}>
          <Ionicons name="arrow-forward" size={14} color="#cbd5e1" />
        </View>
        <View style={styles.routePoint}>
          <Text style={styles.routeLabel}>To</Text>
          <Text style={styles.cityName}>{shipment.destination}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        {!isCompleted && shipment.eta_date && (
          <Text style={styles.etaText}>
            ETA {formatETA(shipment.eta_date, shipment.eta_time)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function MyShipments() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getShipments();
      setShipments(data);
    } catch {
      // Handled by empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(true);
      const interval = setInterval(() => load(true), 30000);
      return () => clearInterval(interval);
    }, [load])
  );

  const tabShipments = activeTab === 'active'
    ? shipments.filter(s => s.current_phase !== 'completed')
    : shipments.filter(s => s.current_phase === 'completed');

  const filtered = query.trim()
    ? tabShipments.filter(s => {
      const q = query.toLowerCase();
      return s.tracking_id.toLowerCase().includes(q) || s.origin.toLowerCase().includes(q) || s.destination.toLowerCase().includes(q);
    })
    : tabShipments;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.slate} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topSection}>
        <View style={styles.header}>
          <View style={styles.userRow}>
            <View>
              <Text style={styles.greeting}>Welcome,</Text>
              <Text style={styles.userName}>{user?.name ?? 'Customer'}</Text>
            </View>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarChar}>{(user?.name ?? 'C')[0]}</Text>
            </View>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tracking ID or city..."
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
            />
          </View>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabLabel, activeTab === 'active' && styles.tabLabelActive]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>History</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.slate} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name={activeTab === 'active' ? "cube-outline" : "archive-outline"} size={60} color="#e2e8f0" />
            <Text style={styles.emptyText}>No {activeTab} shipments</Text>
          </View>
        ) : (
          filtered.map(s => <ShipmentCard key={s.id} shipment={s} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topSection: { backgroundColor: Colors.slateDark, paddingBottom: 20, paddingTop: StatusBar.currentHeight || 40 },
  header: { paddingHorizontal: 20, gap: 16 },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  userName: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  avatarWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  avatarChar: { color: '#FFF', fontSize: 18, fontWeight: '800' },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 12, height: 44, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#FFF' },

  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, marginHorizontal: 20, marginTop: 20, padding: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  tabLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  tabLabelActive: { color: '#FFF' },

  list: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, borderLeftWidth: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  trackingIdBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  trackingIdText: { fontSize: 11, fontWeight: '800', color: Colors.slate, letterSpacing: 0.5 },

  routeContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  routePoint: { flex: 1 },
  routeLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  cityName: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  routeArrow: { paddingHorizontal: 4 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderColor: '#f1f5f9' },
  statusText: { fontSize: 13, fontWeight: '700' },
  etaText: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
});
