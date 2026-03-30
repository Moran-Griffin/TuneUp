import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';
import { useAppointments } from '@/hooks/useAppointments';
import { ScheduledAppointmentModal } from '@/components/ScheduledAppointmentModal';
import { ServiceType, Shop } from '@/types';
import '../global.css';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const { vehicle } = useVehicle(session?.user.id);
  const { addAppointment } = useAppointments(vehicle?.id);

  const pendingShop = useRef<Shop | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/(auth)/welcome');
  }, [session, loading]);

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

  async function handleAppointmentYes(data: { service_type: ServiceType; scheduled_date: string; scheduled_time: string }) {
    setModalVisible(false);
    if (!pendingShop.current) return;
    await addAppointment({
      shop_name: pendingShop.current.name,
      shop_url: pendingShop.current.website,
      ...data,
    });
    pendingShop.current = null;
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
