import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { FormScrollView } from '@/components/FormScrollView';
import { VehicleForm } from '@/components/VehicleForm';

export default function NewVehicleScreen() {
  return (
    <FormScrollView className="flex-1 bg-white dark:bg-[#1c1c1e]" contentContainerClassName="px-6 pt-16 pb-8">
      <View className="flex-row items-center mb-6">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Text className="text-blue-600 dark:text-[#0a84ff] text-base">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold dark:text-white flex-1">Add Vehicle</Text>
      </View>
      <VehicleForm vehicle={null} onSaved={() => router.back()} />
    </FormScrollView>
  );
}
