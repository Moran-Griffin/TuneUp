import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';
import { useMaintenanceLogs } from '@/hooks/useMaintenanceLogs';
import { ServiceDueCard } from '@/components/ServiceDueCard';
import { LogEntryItem } from '@/components/LogEntryItem';
import { getOilChangeStatus, getInspectionStatus } from '@/lib/serviceStatus';

export default function HomeScreen() {
  const { session } = useAuth();
  const { vehicle, loading: vehicleLoading } = useVehicle(session?.user.id);
  const { logs } = useMaintenanceLogs(vehicle?.id);

  if (vehicleLoading) {
    return <View className="flex-1 items-center justify-center"><Text className="text-gray-400">Loading...</Text></View>;
  }

  if (!vehicle) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-gray-400 text-center">No vehicle set up yet.</Text>
      </View>
    );
  }

  const oilStatus = getOilChangeStatus(vehicle);
  const inspectionStatus = getInspectionStatus(vehicle);
  const recentLogs = logs.slice(0, 5);

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white pt-16 pb-4 px-4 border-b border-gray-100">
        <Text className="text-2xl font-bold">{vehicle.year} {vehicle.make} {vehicle.model}</Text>
        <Text className="text-gray-500">{vehicle.current_mileage.toLocaleString()} miles</Text>
      </View>

      <View className="px-4 pt-4">
        <Text className="font-semibold text-gray-700 mb-3">Service Status</Text>
        <ServiceDueCard
          title="Oil Change"
          status={oilStatus}
          onSchedule={() => router.push('/(tabs)/schedule')}
        />
        <ServiceDueCard
          title="Inspection"
          status={inspectionStatus}
          onSchedule={() => router.push('/(tabs)/schedule')}
        />
      </View>

      <View className="px-4 pt-2 pb-8">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-semibold text-gray-700">Recent Service</Text>
          <TouchableOpacity onPress={() => router.push('/log/new')}>
            <Plus size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>
        {recentLogs.length === 0 ? (
          <Text className="text-gray-400 text-center py-4">No service history yet</Text>
        ) : (
          recentLogs.map(log => (
            <LogEntryItem key={log.id} log={log} onPress={() => router.push(`/log/${log.id}`)} />
          ))
        )}
      </View>
    </ScrollView>
  );
}
