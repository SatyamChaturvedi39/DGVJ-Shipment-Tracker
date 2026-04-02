import { Tabs, Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

function CustomerName({ name }: { name: string }) {
  return (
    <View style={{ marginRight: 16 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

export default function CustomerLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user || user.role !== 'customer') return <Redirect href="/auth/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.darkHeader },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surfaceElevated,
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
          headerRight: () => <CustomerName name={user.name ?? 'Customer'} />,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>&#128230;</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>&#128100;</Text>,
        }}
      />
      <Tabs.Screen
        name="shipment-tracking"
        options={{
          title: 'Track Shipment',
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
