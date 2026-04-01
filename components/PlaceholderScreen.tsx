import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

interface PlaceholderScreenProps {
  role: UserRole;
  screenName: string;
}

const roleBadgeColors: Record<UserRole, string> = {
  admin: Colors.primary,
  employee: Colors.primary,
  customer: Colors.primary,
};

export function PlaceholderScreen({ role, screenName }: PlaceholderScreenProps) {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <View style={[styles.badge, { backgroundColor: roleBadgeColors[role] }]}>
          <Text style={styles.badgeText}>{role.toUpperCase()}</Text>
        </View>
        <Text style={styles.screenName}>{screenName}</Text>
        <Text style={styles.subtitle}>This screen will be built in a future phase.</Text>
      </Card>
      <Button title="Sign Out" variant="outline" onPress={logout} style={styles.signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  screenName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  signOut: {
    marginTop: 32,
    width: '100%',
    maxWidth: 320,
  },
});
