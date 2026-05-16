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
import { Config } from '@/constants/config';
import { PHASE_CONFIG } from '@/constants/phases';
import { getShipments } from '@/services/api';
import { formatETA, formatFullDate } from '@/utils/formatDate';
import { useAuth } from '@/hooks/useAuth';
import type { Shipment } from '@/types';

function RoleBadge({ role }: { role: 'pickup' | 'delivery' }) {
  const isPickup = role === 'pickup';
  return (
    <View style={[styles.roleBadge, { backgroundColor: isPickup ? '#fef3c7' : '#e0f2fe' }]}>
      <Ionicons name={isPickup ? "arrow-up-circle-outline" : "arrow-down-circle-outline"} size={12} color={isPickup ? '#d97706' : '#0284c7'} style={{ marginRight: 4 }} />
      <Text style={[styles.roleBadgeText, { color: isPickup ? '#d97706' : '#0284c7' }]}>
        {isPickup ? 'PICKUP' : 'DELIVERY'}
      </Text>
    </View>
  );
}

function getEmployeeRole(shipment: Shipment, userId: string): 'pickup' | 'delivery' {
  if (shipment.delivery_employee_id === userId) return 'delivery';
  return 'pickup';
}

function JobCard({ shipment, employeeRole }: { shipment: Shipment; employeeRole: 'pickup' | 'delivery' }) {
  const isCompleted = shipment.current_phase === 'completed';
  const cfg = PHASE_CONFIG[shipment.current_phase];

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/(employee)/job-detail?id=${shipment.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.trackingIdWrap}>
          <Text style={styles.trackingIdText}>{shipment.tracking_id}</Text>
        </View>
        <RoleBadge role={employeeRole} />
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <Text style={styles.cityName}>{shipment.origin}</Text>
          <Text style={styles.routeLabel}>Origin</Text>
        </View>
        <View style={styles.routeLine}>
          <View style={styles.line} />
          <Ionicons name="chevron-forward" size={14} color="#e2e8f0" />
          <View style={styles.line} />
        </View>
        <View style={[styles.routePoint, { alignItems: 'flex-end' }]}>
          <Text style={styles.cityName}>{shipment.destination}</Text>
          <Text style={styles.routeLabel}>Destination</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
        {isCompleted ? (
          <Text style={styles.footerNote}>Done {formatFullDate(shipment.completed_at)}</Text>
        ) : shipment.eta_date ? (
          <Text style={styles.footerNote}>ETA {formatETA(shipment.eta_date, shipment.eta_time)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function MyJobs() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

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
      const interval = setInterval(() => load(true), 20000);
      return () => clearInterval(interval);
    }, [load])
  );

  const userId = user?.id ?? '';
  const isAssigned = (s: Shipment) => Config.DEV_MOCK_AUTH || s.pickup_employee_id === userId || s.delivery_employee_id === userId;

  const activeJobs = shipments.filter(s => {
    if (!isAssigned(s)) return false;
    if (s.current_phase === 'completed') return false;
    if (Config.DEV_MOCK_AUTH) return true;
    const role = getEmployeeRole(s, userId);
    if (role === 'pickup') return s.current_phase === 'pickup' || s.current_phase === 'transit';
    return true;
  });

  const completedJobs = shipments.filter(s => s.current_phase === 'completed' && isAssigned(s));
  const displayed = tab === 'active' ? activeJobs : completedJobs;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.slate} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Field Operations</Text>
        <Text style={styles.headerSub}>{activeJobs.length} Assigned Tasks</Text>
      </View>

      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, tab === 'active' && styles.tabActive]}
            onPress={() => setTab('active')}
          >
            <Text style={[styles.tabLabel, tab === 'active' && styles.tabLabelActive]}>Active ({activeJobs.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'completed' && styles.tabActive]}
            onPress={() => setTab('completed')}
          >
            <Text style={[styles.tabLabel, tab === 'completed' && styles.tabLabelActive]}>History</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.slate} />}
      >
        {displayed.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name={tab === 'active' ? "briefcase-outline" : "checkmark-done-outline"} size={60} color="#e2e8f0" />
            <Text style={styles.emptyText}>{tab === 'active' ? 'No active assignments' : 'No history yet'}</Text>
          </View>
        ) : (
          displayed.map(s => <JobCard key={s.id} shipment={s} employeeRole={getEmployeeRole(s, userId)} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  headerSub: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 4 },

  tabContainer: { paddingHorizontal: 20, marginBottom: 12 },
  tabBar: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  tabActive: { backgroundColor: Colors.slate, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabLabelActive: { color: '#FFF' },

  list: { padding: 20, paddingTop: 0, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  trackingIdWrap: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  trackingIdText: { fontSize: 12, fontWeight: '800', color: Colors.slate, letterSpacing: 0.5 },
  
  roleBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  routeContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  routePoint: { flex: 1, gap: 4 },
  cityName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  routeLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  routeLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  line: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderColor: '#f1f5f9' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  footerNote: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
});
