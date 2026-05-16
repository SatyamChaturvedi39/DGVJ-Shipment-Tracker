import { Tabs, Redirect, useRouter } from 'expo-router';
import { Text, TouchableOpacity, Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AdminLayout() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

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
          <TouchableOpacity 
            onPress={handleLogout} 
            style={{ 
              marginRight: 16, 
              paddingVertical: 6, 
              paddingHorizontal: 12, 
              borderRadius: 8, 
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)'
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>Sign Out</Text>
          </TouchableOpacity>
        ),
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surfaceElevated,
          borderTopColor: Colors.border,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create-shipment"
        options={{
          title: 'New',
          tabBarIcon: ({ color }) => <Ionicons name="add-circle-outline" size={32} color={color} />,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: 'Archive',
          tabBarIcon: ({ color }) => <Ionicons name="archive-outline" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai-assistant"
        options={{
          title: 'Digi AI',
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="sparkles" size={26} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="shipment-detail"
        options={{
          title: 'Shipment Details',
          href: null,
          tabBarStyle: { display: 'none' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8, padding: 8 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 24, lineHeight: 24 }}>&#8592;</Text>
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}
