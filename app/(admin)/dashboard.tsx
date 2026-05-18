import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { PHASE_CONFIG } from '@/constants/phases';
import { getShipments } from '@/services/api';
import { formatETA } from '@/utils/formatDate';
import { useAuth } from '@/hooks/useAuth';
import type { Shipment, ShipmentPhase } from '@/types';

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const cfg = PHASE_CONFIG[shipment.current_phase] ?? PHASE_CONFIG.pickup;
  
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/(admin)/shipment-detail?id=${shipment.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.trackingBadge}>
          <Text style={styles.trackingText}>{shipment.tracking_id}</Text>
        </View>
        <View style={[styles.phaseBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.phaseText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.routeBox}>
        <View style={styles.routePoint}>
          <Text style={styles.cityText}>{shipment.origin}</Text>
          <Text style={styles.routeLabel}>Origin</Text>
        </View>
        <View style={styles.routeLine}>
          <View style={styles.line} />
          <Ionicons name={shipment.transport_mode === 'air' ? 'airplane' : 'train'} size={14} color="#cbd5e1" />
          <View style={styles.line} />
        </View>
        <View style={[styles.routePoint, { alignItems: 'flex-end' }]}>
          <Text style={styles.cityText}>{shipment.destination}</Text>
          <Text style={styles.routeLabel}>Destination</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="time-outline" size={14} color="#94a3b8" />
          <Text style={styles.footerText}>
            {shipment.eta_date ? formatETA(shipment.eta_date, shipment.eta_time) : 'No ETA'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#e2e8f0" />
      </View>
    </TouchableOpacity>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setShipments(await getShipments());
    } catch {
      // Error handled by empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(true);
      const interval = setInterval(() => load(true), 20000);
      return () => clearInterval(interval);
    }, [load])
  );

  const active = shipments.filter(s => s.current_phase !== 'completed');
  const transit = shipments.filter(s => s.current_phase === 'transit' || s.current_phase === 'handed_to_carrier').length;
  const outDelivery = shipments.filter(s => s.current_phase === 'out_for_delivery').length;
  const pickup = shipments.filter(s => s.current_phase === 'pickup').length;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.slate} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.slate} />}
    >
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.userName}>{user?.name ? user.name.split(' ')[0] : 'Commander'}</Text>
        </View>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarChar}>{(user?.name ?? 'A')[0]}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Live Jobs" value={active.length} icon="flash-outline" color="#3b82f6" />
        <StatCard label="Pickups" value={pickup} icon="cube-outline" color="#f59e0b" />
        <StatCard label="In Transit" value={transit} icon="airplane-outline" color="#8b5cf6" />
        <StatCard label="Delivering" value={outDelivery} icon="bicycle-outline" color="#10b981" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Priority Shipments</Text>
        <TouchableOpacity onPress={() => load(true)}>
          <Ionicons name="refresh-outline" size={18} color={Colors.slate} />
        </TouchableOpacity>
      </View>

      {active.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="shield-checkmark-outline" size={60} color="#e2e8f0" />
          <Text style={styles.emptyText}>All operations are completed</Text>
        </View>
      ) : (
        active.slice(0, 10).map(s => <ShipmentCard key={s.id} shipment={s} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 10 },
  greeting: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  userName: { fontSize: 24, fontWeight: '800', color: Colors.slateDark, marginTop: 2 },
  avatarWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.slate, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.slate, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  avatarChar: { color: '#FFF', fontSize: 18, fontWeight: '800' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  statCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.slateDark },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 1 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.slateDark },

  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  trackingBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  trackingText: { fontSize: 11, fontWeight: '800', color: Colors.slate, letterSpacing: 0.5 },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  phaseText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  routeBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  routePoint: { flex: 1, gap: 4 },
  cityText: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  routeLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  routeLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  line: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderColor: '#f1f5f9' },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
});
