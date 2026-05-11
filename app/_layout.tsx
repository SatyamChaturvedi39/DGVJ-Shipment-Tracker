import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateLocation } from '@/services/api';
import { Config } from '@/constants/config';

export const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[TaskManager] Location error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    if (locations && locations.length > 0) {
      const loc = locations[0];
      const { latitude, longitude } = loc.coords;
      
      try {
        const shipmentId = await AsyncStorage.getItem('active_tracking_shipment_id');
        if (shipmentId && !Config.DEV_MOCK_AUTH) {
          await updateLocation({ shipment_id: shipmentId, lat: latitude, lng: longitude });
        }
      } catch (e) {
        console.warn('[TaskManager] Failed to update location:', e);
      }
    }
  }
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(employee)" />
        <Stack.Screen name="(customer)" />
      </Stack>
    </AuthProvider>
  );
}
