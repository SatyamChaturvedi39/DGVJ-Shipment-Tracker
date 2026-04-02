import { Tabs, Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

function EmployeeName({ name }: { name: string }) {
  return (
    <View style={{ marginRight: 16 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

export default function EmployeeLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user || user.role !== 'employee') return <Redirect href="/auth/login" />;

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
          headerRight: () => <EmployeeName name={user.name ?? 'Employee'} />,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>&#9898;</Text>,
        }}
      />
      <Tabs.Screen
        name="job-detail"
        options={{
          title: 'Job Details',
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
