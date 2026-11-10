import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { Stack, router } from 'expo-router';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/hooks/useAuth';
import { VehicleProvider, useVehicles } from '@/hooks/VehicleContext';
import { useAppointments } from '@/hooks/useAppointments';
import { ScheduledAppointmentModal } from '@/components/ScheduledAppointmentModal';
import { startLocationTracking } from '@/lib/locationTask';
import { replayQueue, getQueueCount } from '@/lib/offlineQueue';
import { ServiceType, Shop } from '@/types';
import '../global.css';

export default function RootLayout() {
  const { session, loading } = useAuth();
  return (
    <KeyboardProvider>
      <VehicleProvider userId={session?.user.id}>
        <RootNavigator session={session} loading={loading} />
      </VehicleProvider>
    </KeyboardProvider>
  );
}

function RootNavigator({ session, loading }: { session: ReturnType<typeof useAuth>['session']; loading: boolean }) {
  const { setColorScheme } = useColorScheme();

  // Restore saved color scheme preference on startup
  useEffect(() => {
    AsyncStorage.getItem('colorScheme').then(saved => {
      if (saved === 'dark' || saved === 'light') setColorScheme(saved);
    });
  }, []);
  const { selectedVehicle: vehicle, selectVehicle, setHomeView } = useVehicles();
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
    startLocationTracking().catch((e: unknown) => console.warn('Location tracking failed:', e));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    getQueueCount().then(count => {
      if (count === 0) return;
      replayQueue().then(({ replayed, failed }) => {
        if (replayed > 0) Alert.alert('Synced', `${replayed} offline ${replayed === 1 ? 'entry' : 'entries'} saved.`);
        if (failed > 0) console.warn(`Offline queue: ${failed} entries still pending.`);
      });
    });
  }, [session]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'location_prompt') {
        router.push('/log/new');
      } else if (data?.type === 'maintenance_reminder') {
        if (typeof data.vehicleId === 'string') {
          selectVehicle(data.vehicleId);
          setHomeView('detail');
        }
        router.push({ pathname: '/(tabs)/schedule', params: { tab: 'shops' } });
      } else if (data?.type === 'mileage_update') {
        router.push('/(tabs)/profile');
      }
    });
    return () => sub.remove();
  }, [selectVehicle, setHomeView]);

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
