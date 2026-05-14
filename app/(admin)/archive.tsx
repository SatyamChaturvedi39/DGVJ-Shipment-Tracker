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
import { router } from 'expo-router';
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
      activeOpacity={0.72}
      onPress={() => router.push(`/(admin)/shipment-detail?id=${item.id}`)}
    >
      {/* Left accent + icon */}
      <View style={styles.cardIconWrap}>
        <Text style={styles.cardIcon}>{isAir ? '✈' : '🚂'}</Text>
      </View>

      {/* Main content */}
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.trackingId} numberOfLines={1}>{item.tracking_id}</Text>
          <View style={styles.doneChip}>
            <Text style={styles.doneChipText}>✓ Done</Text>
          </View>
        </View>
        <Text style={styles.route} numberOfLines={1}>
          <Text style={styles.routeCity}>{item.origin}</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.textSecondary} style={{ marginHorizontal: 8 }} />
          <Text style={styles.routeCity}>{item.destination}</Text>
        </Text>
        <Text style={styles.completedDate}>{formatFullDate(item.completed_at)}</Text>
      </View>

      {/* Chevron */}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function Archive() {
  const [shipments, setShipments]     = useState<Shipment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [query, setQuery]             = useState('');
  const [modeFilter, setModeFilter]   = useState<ModeFilter>('all');

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
        <Text style={styles.loadingText}>Loading archive…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>📭</Text>
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
          placeholder="Search by ID, origin or destination…"
          placeholderTextColor={Colors.textMuted}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips + count row */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
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
        </ScrollView>
        <Text style={styles.filterCount}>
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ShipmentCard item={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{query ? '🔍' : '🗂️'}</Text>
            <Text style={styles.emptyTitle}>
              {query ? 'No results found' : 'No completed shipments'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {query
                ? 'Try a different tracking ID or city name.'
                : 'Completed shipments will appear here.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F8F9FA', padding: 32,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: Colors.textSecondary },
  errorIcon:   { fontSize: 40, marginBottom: 12 },
  errorText:   { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: Colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  retryText:   { color: '#FFF', fontWeight: '700', fontSize: 15 },

  // Search bar
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchIcon:    { fontSize: 16, marginRight: 8, color: Colors.textMuted },
  searchInput:   { flex: 1, fontSize: 15, color: Colors.textPrimary, paddingVertical: 6 },
  clearBtn:      { paddingHorizontal: 6, paddingVertical: 4 },
  clearBtnText:  { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },

  // Filter bar (chips + count on same row)
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    paddingRight: 14,
  },
  filterChips: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  filterChipActive: {
    backgroundColor: '#FFF0F0',
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  filterCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    flexShrink: 0,
    marginLeft: 4,
  },

  // List
  listContent:    { paddingVertical: 10, paddingHorizontal: 14, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1 },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  cardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardIcon:   { fontSize: 20 },
  cardBody:   { flex: 1, minWidth: 0 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  trackingId: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.4,
    flexShrink: 1,
    marginRight: 8,
  },
  route: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  completedDate: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  doneChip: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  doneChipText: { fontSize: 11, fontWeight: '700', color: '#2E7D32' },
  chevron:      { fontSize: 22, color: '#CCCCCC', fontWeight: '300', flexShrink: 0 },

  // Empty state
  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon:     { fontSize: 52, marginBottom: 16 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
});
