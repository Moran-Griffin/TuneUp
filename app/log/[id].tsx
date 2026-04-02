import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useColorScheme } from 'nativewind';
import { router, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';
import { useMaintenanceLogs } from '@/hooks/useMaintenanceLogs';
import { SERVICE_TYPE_LABELS } from '@/constants/maintenance';
import { ServiceType } from '@/types';

export default function EditLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme: scheme } = useColorScheme();
  const { session } = useAuth();
  const { vehicle } = useVehicle(session?.user.id);
  const { logs, updateLog, deleteLog } = useMaintenanceLogs(vehicle?.id);

  const log = logs.find(l => l.id === id);

  const [type, setType] = useState<ServiceType>(log?.type ?? 'oil_change');
  const [date, setDate] = useState(log?.date ?? '');
  const [mileage, setMileage] = useState(log?.mileage?.toString() ?? '');
  const [shopName, setShopName] = useState(log?.shop_name ?? '');
  const [cost, setCost] = useState(log?.cost?.toString() ?? '');
  const [notes, setNotes] = useState(log?.notes ?? '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (log) {
      setType(log.type);
      setDate(log.date);
      setMileage(log.mileage?.toString() ?? '');
      setShopName(log.shop_name ?? '');
      setCost(log.cost?.toString() ?? '');
      setNotes(log.notes ?? '');
    }
  }, [log]);

  async function handleSave() {
    if (!date) { Alert.alert('Error', 'Date is required.'); return; }
    setLoading(true);
    try {
      await updateLog(id, {
        type,
        date,
        mileage: mileage ? parseInt(mileage, 10) : null,
        shop_name: shopName || null,
        cost: cost ? parseFloat(cost) : null,
        notes: notes || null,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    Alert.alert('Delete Entry', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteLog(id);
          router.back();
        } catch (e: any) {
          Alert.alert('Error', e.message);
        }
      }},
    ]);
  }

  if (!log) return null;

  const pickerStyle = scheme === 'dark' ? { color: '#ffffff', backgroundColor: '#2c2c2e' } : {};

  return (
    <ScrollView className="flex-1 bg-white dark:bg-[#1c1c1e]" contentContainerClassName="px-6 pt-16 pb-8">
      <View className="flex-row items-center mb-6">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Text className="text-blue-600 dark:text-[#0a84ff] text-base">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold dark:text-white flex-1">Edit Entry</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          <Text className="text-blue-600 dark:text-[#0a84ff] font-semibold text-base">{loading ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">Service Type *</Text>
      <View className="border border-gray-300 dark:border-[#3a3a3c] rounded-xl mb-4 dark:bg-[#2c2c2e]">
        <Picker
          selectedValue={type}
          onValueChange={(v) => setType(v as ServiceType)}
          style={pickerStyle}
          itemStyle={scheme === 'dark' ? { color: '#ffffff' } : {}}
        >
          {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([value, label]) => (
            <Picker.Item key={value} label={label} value={value} />
          ))}
        </Picker>
      </View>

      <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">Date *</Text>
      <TextInput
        className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={scheme === 'dark' ? '#636366' : '#9ca3af'}
      />

      <Text className="text-sm font-medium text-gray-400 dark:text-[#636366] mb-1">Mileage (optional)</Text>
      <TextInput
        className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
        value={mileage}
        onChangeText={setMileage}
        keyboardType="numeric"
        placeholderTextColor={scheme === 'dark' ? '#636366' : '#9ca3af'}
      />

      <Text className="text-sm font-medium text-gray-400 dark:text-[#636366] mb-1">Shop Name (optional)</Text>
      <TextInput
        className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
        value={shopName}
        onChangeText={setShopName}
        placeholderTextColor={scheme === 'dark' ? '#636366' : '#9ca3af'}
      />

      <Text className="text-sm font-medium text-gray-400 dark:text-[#636366] mb-1">Cost (optional)</Text>
      <TextInput
        className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
        value={cost}
        onChangeText={setCost}
        keyboardType="decimal-pad"
        placeholderTextColor={scheme === 'dark' ? '#636366' : '#9ca3af'}
      />

      <Text className="text-sm font-medium text-gray-400 dark:text-[#636366] mb-1">Notes (optional)</Text>
      <TextInput
        className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        placeholderTextColor={scheme === 'dark' ? '#636366' : '#9ca3af'}
      />

      <TouchableOpacity className="mt-4 items-center" onPress={handleDelete}>
        <Text className="text-red-500 dark:text-[#ff453a] font-medium">Delete Entry</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
