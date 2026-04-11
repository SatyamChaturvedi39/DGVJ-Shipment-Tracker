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
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { getShipments } from '@/services/api';
import { formatFullDate } from '@/utils/formatDate';
import type { Shipment, TransportMode } from '@/types';

type ModeFilter = 'all' | TransportMode;

function ShipmentCard({ item }: { item: Shipment }) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.72}
      onPress={() => router.push(`/(admin)/shipment-detail?id=${item.id}`)}
    >
      <View style={styles.cardLeft}>
        <View style={styles.modeCircle}>
          <Text style={styles.modeEmoji}>{item.transport_mode === 'air' ? '✈' : '🚂'}</Text>
        </View>
      </View>
      <View style={styles.cardCenter}>
        <Text style={styles.trackingId}>{item.tracking_id}</Text>
        <Text style={styles.route} numberOfLines={1}>
          {item.origin}  →  {item.destination}
        </Text>
        <Text style={styles.completedDate}>{formatFullDate(item.completed_at)}</Text>
      </View>
      <View style={styles.cardRight}>
        <View style={styles.doneChip}>
          <Text style={styles.doneChipText}>✓ Done</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function Archive() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [query, setQuery]         = useState('');
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
      setError('Could not load archive. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by tracking ID or city…"
          placeholderTextColor={Colors.textMuted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Mode filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {(['all', 'air', 'train'] as ModeFilter[]).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[styles.filterChip, modeFilter === mode && styles.filterChipActive]}
            onPress={() => setModeFilter(mode)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, modeFilter === mode && styles.filterChipTextActive]}>
              {mode === 'all' ? 'All' : mode === 'air' ? '✈ Air' : '🚂 Train'}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.filterCount}>{filtered.length} shipments</Text>
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ShipmentCard item={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.primary} />
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{query ? '🔍' : '🗂️'}</Text>
            <Text style={styles.emptyTitle}>
              {query ? 'No results found' : 'No completed shipments'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {query ? 'Try a different search term.' : 'Completed shipments will appear here.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 24 },
  errorText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  retryBtn:  { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E8',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.textPrimary, height: 36 },

  // Filter chips
  filterRow: {
    paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center',
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E8',
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#F8F9FA',
  },
  filterChipActive: {
    backgroundColor: '#FFF0F0', borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13, fontWeight: '600', color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  filterCount: {
    marginLeft: 8, fontSize: 12, color: Colors.textMuted, fontWeight: '500',
  },

  // List
  listContent:    { paddingVertical: 10, paddingHorizontal: 12, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1 },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#E8E8E8',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
    elevation: 1, gap: 12,
  },
  cardLeft: { justifyContent: 'center' },
  modeCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E8E8E8',
    justifyContent: 'center', alignItems: 'center',
  },
  modeEmoji:      { fontSize: 18 },
  cardCenter:     { flex: 1 },
  trackingId:     { fontSize: 14, fontWeight: '700', color: Colors.primary, letterSpacing: 0.4, marginBottom: 2 },
  route:          { fontSize: 13, color: Colors.textSecondary, marginBottom: 3 },
  completedDate:  { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  cardRight:      { alignItems: 'flex-end' },
  doneChip:       { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  doneChipText:   { fontSize: 11, fontWeight: '700', color: '#2E7D32' },

  // Empty state
  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  emptyIcon:     { fontSize: 48, marginBottom: 16 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
});
