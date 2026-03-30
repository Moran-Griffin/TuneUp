import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
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
  const { session } = useAuth();
  const { vehicle } = useVehicle(session?.user.id);
  const { appointments } = useAppointments(vehicle?.id);
  const { results, loading: searchLoading, searchNearby } = useShopSearch();

  async function handleFindShops() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    searchNearby(loc.coords.latitude, loc.coords.longitude);
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
        appointments.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-gray-400 text-center">No upcoming appointments. Find a shop to book one.</Text>
          </View>
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <AppointmentItem appointment={item} />}
          />
        )
      ) : searchLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
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
        />
      )}
    </View>
  );
}
