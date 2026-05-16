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
import type { Shipment, ShipmentPhase, TransportMode } from '@/types';

const PHASE_CONFIG: Record<ShipmentPhase, { bg: string; text: string; icon: string; label: string }> = {
  pickup:            { bg: '#fef3c7', text: '#d97706', icon: 'cube-outline', label: 'Driver heading to pickup' },
  transit:           { bg: '#e0f2fe', text: '#0284c7', icon: 'car-outline', label: 'Moving to terminal' },
  handed_to_carrier: { bg: '#f3e8ff', text: '#9333ea', icon: 'airplane-outline', label: 'In transit via carrier' },
  out_for_delivery:  { bg: '#fef3c7', text: '#d97706', icon: 'bicycle-outline', label: 'Out for delivery' },
  completed:         { bg: '#f0fdf4', text: '#16a34a', icon: 'checkmark-circle-outline', label: 'Successfully Delivered' },
};

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const config = PHASE_CONFIG[shipment.current_phase];
  const isCompleted = shipment.current_phase === 'completed';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/(customer)/shipment-tracking?id=${shipment.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.trackingIdBadge}>
          <Text style={styles.trackingIdText}>{shipment.tracking_id}</Text>
        </View>
        <Ionicons 
          name={shipment.transport_mode === 'air' ? 'airplane' : 'train'} 
          size={18} 
          color="#94a3b8" 
        />
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <View style={[styles.dot, { backgroundColor: Colors.slate }]} />
          <Text style={styles.cityName}>{shipment.origin}</Text>
        </View>
        <View style={styles.routeLine}>
          <View style={styles.lineDashed} />
          <Ionicons name="chevron-forward" size={14} color="#e2e8f0" />
        </View>
        <View style={styles.routePoint}>
          <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.cityName}>{shipment.destination}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon as any} size={12} color={config.text} style={{ marginRight: 6 }} />
          <Text style={[styles.statusText, { color: config.text }]}>{config.label}</Text>
        </View>
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
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Shipments</Text>
        <Text style={styles.headerSub}>{shipments.length} Total Parcels</Text>
      </View>

      <View style={styles.tabContainer}>
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

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search shipments..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.slate} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name={activeTab === 'active' ? "cube-outline" : "archive-outline"} size={60} color="#e2e8f0" />
            <Text style={styles.emptyText}>No shipments found</Text>
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
  header: { backgroundColor: Colors.slateDark, paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '600' },

  tabContainer: { paddingHorizontal: 20, paddingTop: 16 },
  tabBar: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  tabActive: { backgroundColor: Colors.slate, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabLabelActive: { color: '#FFF' },

  searchContainer: { paddingHorizontal: 20, paddingVertical: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#f1f5f9', gap: 10 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.slateDark },

  list: { padding: 20, paddingTop: 0, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  trackingIdBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  trackingIdText: { fontSize: 12, fontWeight: '800', color: Colors.slate, letterSpacing: 0.5 },
  
  routeContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  routePoint: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cityName: { fontSize: 13, fontWeight: '700', color: Colors.slateDark },
  routeLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  lineDashed: { flex: 1, height: 1, backgroundColor: '#e2e8f0', borderRadius: 1 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  etaText: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 14, color: '#94a3b8', marginTop: 12, fontWeight: '500' },
});
