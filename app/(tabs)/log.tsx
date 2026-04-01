import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';
import { useMaintenanceLogs } from '@/hooks/useMaintenanceLogs';
import { LogEntryItem } from '@/components/LogEntryItem';
import { SERVICE_TYPE_LABELS } from '@/constants/maintenance';
import { ServiceType } from '@/types';

type Filter = 'all' | ServiceType;

export default function LogScreen() {
  const { session } = useAuth();
  const { vehicle, refetch: refetchVehicle } = useVehicle(session?.user.id);
  const { logs, loading, refetch: refetchLogs } = useMaintenanceLogs(vehicle?.id);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(useCallback(() => {
    refetchVehicle();
    refetchLogs();
  }, [refetchVehicle, refetchLogs]));

  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter);
  const filterOptions: Filter[] = ['all', ...Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white pt-16 pb-3 px-4 border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-bold">Service Log</Text>
          <TouchableOpacity onPress={() => router.push(filter === 'all' ? '/log/new' : `/log/new?type=${filter}`)}>
            <Plus size={24} color="#2563eb" />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filterOptions.map(f => (
            <TouchableOpacity
              key={f}
              className={`mr-2 px-3 py-1 rounded-full ${filter === f ? 'bg-blue-600' : 'bg-gray-100'}`}
              onPress={() => setFilter(f)}
            >
              <Text className={`text-sm ${filter === f ? 'text-white font-medium' : 'text-gray-600'}`}>
                {f === 'all' ? 'All' : SERVICE_TYPE_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400">Loading...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-400 text-center">
            {filter === 'all' ? 'No service records yet. Tap + to add your first entry.' : `No ${SERVICE_TYPE_LABELS[filter as ServiceType]} records.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <LogEntryItem log={item} onPress={() => router.push(`/log/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}
