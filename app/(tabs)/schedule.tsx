import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';
import { useAppointments } from '@/hooks/useAppointments';
import { useShopSearch } from '@/hooks/useShopSearch';
import { ShopListItem } from '@/components/ShopListItem';
import { AppointmentItem } from '@/components/AppointmentItem';
import { Shop } from '@/types';

type Tab = 'appointments' | 'shops';

export default function ScheduleScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('appointments');
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { session } = useAuth();
  const { vehicle } = useVehicle(session?.user.id);
  const { appointments, updateAppointment, refetch } = useAppointments(vehicle?.id);
  const { results, loading: searchLoading, error: searchError, searchNearby } = useShopSearch();

  useFocusEffect(
    useCallback(() => {
      refetch();
      if (tab === 'shops') {
        handleFindShops();
      } else if (tab === 'appointments') {
        setActiveTab('appointments');
      }
    }, [refetch, tab])
  );

  async function handleFindShops() {
    if (results.length > 0) {
      setActiveTab('shops');
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    await searchNearby(loc.coords.latitude, loc.coords.longitude);
    setActiveTab('shops');
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white pt-16 pb-4 px-4 border-b border-gray-100">
        <Text className="text-2xl font-bold mb-3">Schedule</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'appointments' ? 'bg-blue-600' : 'bg-gray-100'}`}
            onPress={() => setActiveTab('appointments')}
          >
            <Text className={activeTab === 'appointments' ? 'text-white font-medium' : 'text-gray-600'}>Appointments</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'shops' ? 'bg-blue-600' : 'bg-gray-100'}`}
            onPress={handleFindShops}
          >
            <Text className={activeTab === 'shops' ? 'text-white font-medium' : 'text-gray-600'}>Find a Shop</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'appointments' ? (
        <FlatList
          data={appointments}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <AppointmentItem
              appointment={item}
              onCancel={() => {
                Alert.alert('Cancel Appointment', 'Remove this appointment?', [
                  { text: 'Keep', style: 'cancel' },
                  { text: 'Cancel Appointment', style: 'destructive', onPress: async () => {
                    try {
                      await updateAppointment(item.id, 'cancelled');
                      refetch();
                    } catch (e: any) {
                      Alert.alert('Error', e.message ?? 'Something went wrong.');
                    }
                  }},
                ]);
              }}
              onComplete={() => {
                Alert.prompt(
                  'Mark Complete',
                  'Enter your current mileage (optional)',
                  async (value) => {
                    const mileage = value ? parseInt(value, 10) : undefined;
                    try {
                      await updateAppointment(item.id, 'completed', mileage && !isNaN(mileage) ? mileage : undefined);
                      refetch();
                    } catch (e: any) {
                      Alert.alert('Error', e.message ?? 'Something went wrong.');
                    }
                  },
                  'plain-text',
                  '',
                  'numeric'
                );
              }}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center px-8 pt-16">
              <Text className="text-gray-400 text-center">No upcoming appointments. Find a shop to book one.</Text>
            </View>
          }
        />
      ) : searchLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : searchError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-400 text-center">{searchError}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.place_id}
          renderItem={({ item }) => (
            <ShopListItem
              shop={item}
              onPress={() => router.push({ pathname: '/schedule/shop-detail', params: { shop: JSON.stringify(item) } })}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center px-8 pt-16">
              <Text className="text-gray-400 text-center">Tap "Find a Shop" to search nearby.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
