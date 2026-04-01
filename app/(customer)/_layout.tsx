import { Tabs, Redirect } from 'expo-router';
import { Text } from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function CustomerLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user || user.role !== 'customer') return <Redirect href="/auth/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0D9488' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#0D9488',
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="my-shipments"
        options={{
          title: 'My Shipments',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>&#128230;</Text>,
        }}
      />
    </Tabs>
  );
}
