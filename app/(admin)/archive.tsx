import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import { getShipments } from '@/services/api';
import { formatFullDate } from '@/utils/formatDate';
import type { Shipment, TransportMode } from '@/types';

type ModeFilter = 'all' | TransportMode;

function ShipmentCard({ item }: { item: Shipment }) {
  const isAir = item.transport_mode === 'air';
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/(admin)/shipment-detail?id=${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.trackingId}>{item.tracking_id}</Text>
        <View style={styles.doneBadge}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.doneText}>Completed</Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.cityBox}>
          <Text style={styles.cityLabel}>Origin</Text>
          <Text style={styles.cityName}>{item.origin}</Text>
        </View>
        <View style={styles.routeArrow}>
          <Ionicons name="arrow-forward" size={20} color={Colors.textMuted} />
        </View>
        <View style={[styles.cityBox, { alignItems: 'flex-end' }]}>
          <Text style={styles.cityLabel}>Destination</Text>
          <Text style={styles.cityName}>{item.destination}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.modeRow}>
          <Ionicons name={isAir ? 'airplane' : 'train'} size={18} color={Colors.textSecondary} />
          <Text style={styles.modeText}>{isAir ? 'Air' : 'Train'} • {item.transport_number}</Text>
        </View>
        <Text style={styles.completedAt}>{formatFullDate(item.completed_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function Archive() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getShipments();
      const completed = data
        .filter(s => s.current_phase === 'completed')
        .sort((a, b) => {
          const ta = a.completed_at ?? a.created_at;
          const tb = b.completed_at ?? b.created_at;
          return tb.localeCompare(ta);
        });
      setShipments(completed);
    } catch {
      setError('Could not load archive');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  const filtered = shipments.filter(s => {
    const q = query.toLowerCase();
    const matchesQuery = !q ||
      s.tracking_id.toLowerCase().includes(q) ||
      s.destination.toLowerCase().includes(q) ||
      s.origin.toLowerCase().includes(q);
    const matchesMode = modeFilter === 'all' || s.transport_mode === modeFilter;
    return matchesQuery && matchesMode;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search archive..."
            placeholderTextColor={Colors.textMuted}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {(['all', 'air', 'train'] as ModeFilter[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, modeFilter === m && styles.chipActive]}
                onPress={() => setModeFilter(m)}
              >
                <Text style={[styles.chipText, modeFilter === m && styles.chipTextActive]}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.countText}>{filtered.length} total</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ShipmentCard item={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="archive-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>No shipments found</Text>
            <Text style={styles.emptySub}>Completed shipments will appear here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: Colors.background,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.slate,
    borderColor: Colors.slate,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#FFF' },
  countText: { fontSize: 12, color: Colors.textMuted, marginRight: 16, fontWeight: '500' },

  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  trackingId: { fontSize: 15, fontWeight: '800', color: Colors.slate, letterSpacing: 0.5 },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  doneText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cityBox: { flex: 1 },
  cityLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 2 },
  cityName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  routeArrow: { paddingHorizontal: 15 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  completedAt: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  emptySub: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
});
