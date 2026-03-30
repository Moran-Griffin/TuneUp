import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';
import { useMaintenanceLogs } from '@/hooks/useMaintenanceLogs';
import { SERVICE_TYPE_LABELS } from '@/constants/maintenance';
import { ServiceType } from '@/types';

export default function NewLogScreen() {
  const { session } = useAuth();
  const { vehicle } = useVehicle(session?.user.id);
  const { addLog } = useMaintenanceLogs(vehicle?.id);

  const [type, setType] = useState<ServiceType>('oil_change');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mileage, setMileage] = useState('');
  const [shopName, setShopName] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!date) { Alert.alert('Error', 'Date is required.'); return; }
    setLoading(true);
    try {
      await addLog({
        type,
        date,
        mileage: mileage ? parseInt(mileage, 10) : undefined,
        shop_name: shopName || undefined,
        cost: cost ? parseFloat(cost) : undefined,
        notes: notes || undefined,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-6 pt-16 pb-8">
      <View className="flex-row items-center mb-6">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Text className="text-blue-600 text-base">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold flex-1">New Entry</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          <Text className="text-blue-600 font-semibold text-base">{loading ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-sm font-medium text-gray-600 mb-1">Service Type *</Text>
      <View className="border border-gray-300 rounded-xl mb-4">
        <Picker selectedValue={type} onValueChange={(v) => setType(v as ServiceType)}>
          {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([value, label]) => (
            <Picker.Item key={value} label={label} value={value} />
          ))}
        </Picker>
      </View>

      <Text className="text-sm font-medium text-gray-600 mb-1">Date *</Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base"
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
      />

      <Text className="text-sm font-medium text-gray-400 mb-1">Mileage (optional)</Text>
      <TextInput className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base" value={mileage} onChangeText={setMileage} placeholder="e.g. 47500" keyboardType="numeric" />

      <Text className="text-sm font-medium text-gray-400 mb-1">Shop Name (optional)</Text>
      <TextInput className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base" value={shopName} onChangeText={setShopName} placeholder="e.g. Jiffy Lube" />

      <Text className="text-sm font-medium text-gray-400 mb-1">Cost (optional)</Text>
      <TextInput className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base" value={cost} onChangeText={setCost} placeholder="e.g. 49.99" keyboardType="decimal-pad" />

      <Text className="text-sm font-medium text-gray-400 mb-1">Notes (optional)</Text>
      <TextInput className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base" value={notes} onChangeText={setNotes} placeholder="Any notes..." multiline numberOfLines={3} />
    </ScrollView>
  );
}
