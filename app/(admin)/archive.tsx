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
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { getShipments } from '@/services/api';
import { formatFullDate } from '@/utils/formatDate';
import type { Shipment } from '@/types';

function ShipmentRow({ item }: { item: Shipment }) {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => router.push(`/(admin)/shipment-detail?id=${item.id}`)}
    >
      <View style={styles.rowLeft}>
        <View style={styles.modeIcon}>
          <Text style={styles.modeIconText}>{item.transport_mode === 'air' ? '✈' : '🚂'}</Text>
        </View>
      </View>

      <View style={styles.rowCenter}>
        <Text style={styles.trackingId}>{item.tracking_id}</Text>
        <Text style={styles.route} numberOfLines={1}>
          {item.origin} → {item.destination}
        </Text>
      </View>

      <View style={styles.rowRight}>
        <Text style={styles.completedDate}>{formatFullDate(item.completed_at)}</Text>
        <Text style={styles.completedLabel}>Completed</Text>
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

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const filtered = query.trim()
    ? shipments.filter(
        s =>
          s.tracking_id.toLowerCase().includes(query.toLowerCase()) ||
          s.destination.toLowerCase().includes(query.toLowerCase()) ||
          s.origin.toLowerCase().includes(query.toLowerCase())
      )
    : shipments;

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

      {/* Count */}
      <Text style={styles.countLabel}>
        {filtered.length} shipment{filtered.length !== 1 ? 's' : ''}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ShipmentRow item={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🗂️</Text>
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
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    height: 36,
  },
  countLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontWeight: '500',
  },

  // List
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  rowLeft: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeIconText: {
    fontSize: 18,
  },
  rowCenter: {
    flex: 1,
  },
  trackingId: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  route: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  completedDate: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  completedLabel: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
