import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';
import { SelectedVehicleLabel } from '@/components/SelectedVehicleLabel';
import { useAppointments } from '@/hooks/useAppointments';
import { useShopSearch } from '@/hooks/useShopSearch';
import { ShopFinder } from '@/components/ShopFinder';
import { AppointmentItem } from '@/components/AppointmentItem';

type Tab = 'appointments' | 'shops';

export default function ScheduleScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('appointments');
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { session } = useAuth();
  const { vehicle } = useVehicle();
  const { appointments, updateAppointment, refetch } = useAppointments(vehicle?.id);
  const finder = useShopSearch();

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

  function handleFindShops() {
    setActiveTab('shops');
    finder.load();
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-black">
      <View className="bg-white dark:bg-[#1c1c1e] pt-16 pb-4 px-4 border-b border-gray-100 dark:border-[#2c2c2e]">
        <View className="mb-3">
          <Text className="text-2xl font-bold dark:text-white">Schedule</Text>
          <SelectedVehicleLabel />
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'appointments' ? 'bg-blue-600' : 'bg-gray-100 dark:bg-[#2c2c2e]'}`}
            onPress={() => setActiveTab('appointments')}
          >
            <Text className={activeTab === 'appointments' ? 'text-white font-medium' : 'text-gray-600 dark:text-[#8e8e93]'}>Appointments</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'shops' ? 'bg-blue-600' : 'bg-gray-100 dark:bg-[#2c2c2e]'}`}
            onPress={handleFindShops}
          >
            <Text className={activeTab === 'shops' ? 'text-white font-medium' : 'text-gray-600 dark:text-[#8e8e93]'}>Find a Shop</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'appointments' ? (
        <FlatList
          data={appointments}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: 16 }}
          renderItem={({ item, index }) => (
            <AppointmentItem
              appointment={item}
              isFirst={index === 0}
              isLast={index === appointments.length - 1}
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
                    const parsed = value ? parseInt(value, 10) : undefined;
                    const mileage = parsed && !isNaN(parsed) ? parsed : undefined;
                    if (mileage !== undefined && vehicle && mileage < vehicle.current_mileage) {
                      Alert.alert(
                        'Check Mileage',
                        `${mileage.toLocaleString()} mi is less than your current mileage of ${vehicle.current_mileage.toLocaleString()} mi. Please enter your actual current mileage.`
                      );
                      return;
                    }
                    try {
                      await updateAppointment(item.id, 'completed', mileage);
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
              <Text className="text-gray-400 dark:text-[#636366] text-center">No upcoming appointments. Find a shop to book one.</Text>
            </View>
          }
        />
      ) : (
        <ShopFinder finder={finder} />
      )}
    </View>
  );
}
