import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';
import { useAppointments } from '@/hooks/useAppointments';
import { ScheduledAppointmentModal } from '@/components/ScheduledAppointmentModal';
import { registerForPushNotifications } from '@/lib/notifications';
import { startLocationTracking } from '@/lib/locationTask';
import { ServiceType, Shop } from '@/types';
import '../global.css';

export default function RootLayout() {
  const { setColorScheme } = useColorScheme();
  const { session, loading } = useAuth();

  // Restore saved color scheme preference on startup
  useEffect(() => {
    AsyncStorage.getItem('colorScheme').then(saved => {
      if (saved === 'dark' || saved === 'light') setColorScheme(saved);
    });
  }, []);
  const { vehicle } = useVehicle(session?.user.id);
  const { addAppointment } = useAppointments(vehicle?.id);

  const pendingShop = useRef<Shop | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(auth)/welcome');
    } else {
      router.replace('/(tabs)');
    }
  }, [session, loading]);

  useEffect(() => {
    if (!session) return;
    registerForPushNotifications().catch((e: unknown) => console.warn('Push registration failed:', e));
    startLocationTracking().catch((e: unknown) => console.warn('Location tracking failed:', e));
  }, [session]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'location_prompt') {
        router.push('/log/new');
      } else if (data?.type === 'maintenance_reminder') {
        router.push('/(tabs)/schedule');
      } else if (data?.type === 'mileage_update') {
        router.push('/(tabs)/profile');
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state !== 'active') return;
      const raw = await AsyncStorage.getItem('pendingShop');
      if (!raw) return;
      await AsyncStorage.removeItem('pendingShop');
      try {
        pendingShop.current = JSON.parse(raw) as Shop;
        setModalVisible(true);
      } catch {
        // malformed data — ignore
      }
    });
    return () => sub.remove();
  }, []);

  async function handleAppointmentYes(data: { service_type: ServiceType; scheduled_date: string; scheduled_time?: string }) {
    if (!pendingShop.current || !vehicle?.id) {
      setModalVisible(false);
      pendingShop.current = null;
      return;
    }
    try {
      await addAppointment({
        shop_name: pendingShop.current.name,
        shop_url: pendingShop.current.website,
        ...data,
      });
      setModalVisible(false);
      pendingShop.current = null;
      router.push({ pathname: '/(tabs)/schedule', params: { tab: 'appointments' } });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save appointment. Please try again.');
    }
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <ScheduledAppointmentModal
        visible={modalVisible}
        shopName={pendingShop.current?.name ?? ''}
        shopUrl={pendingShop.current?.website}
        onYes={handleAppointmentYes}
        onNo={() => setModalVisible(false)}
      />
    </>
  );
}
