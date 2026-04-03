import { Tabs, Redirect } from 'expo-router';
import { Text, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AdminLayout() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user || user.role !== 'admin') return <Redirect href="/auth/login" />;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.darkHeader },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16, paddingVertical: 4, paddingHorizontal: 8 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Sign Out</Text>
          </TouchableOpacity>
        ),
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
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>&#9783;</Text>,
        }}
      />
      <Tabs.Screen
        name="create-shipment"
        options={{
          title: 'New Shipment',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>+</Text>,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: 'Archive',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>&#9776;</Text>,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>&#128101;</Text>,
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
        name="shipment-detail"
        options={{
          title: 'Shipment Details',
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
