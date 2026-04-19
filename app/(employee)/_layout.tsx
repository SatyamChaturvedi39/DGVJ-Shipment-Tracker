import { Tabs, Redirect, useRouter } from 'expo-router';
import { Text, View, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function EmployeeLayout() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  if (isLoading) return <LoadingSpinner />;
  if (!user || user.role !== 'employee') return <Redirect href="/auth/login" />;

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
        name="my-jobs"
        options={{
          title: 'My Jobs',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 12 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                {user.name ?? 'Employee'}
              </Text>
              <TouchableOpacity onPress={handleLogout} style={{ paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 6 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          ),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>&#9898;</Text>,
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
        name="job-detail"
        options={{
          title: 'Job Details',
          href: null,
          tabBarStyle: { display: 'none' },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginLeft: 8, padding: 8 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 24, lineHeight: 24 }}>&#8592;</Text>
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}
