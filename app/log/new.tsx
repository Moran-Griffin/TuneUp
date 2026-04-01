import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicle';
import { useMaintenanceLogs } from '@/hooks/useMaintenanceLogs';
import { useAppointments } from '@/hooks/useAppointments';
import { SERVICE_TYPE_LABELS } from '@/constants/maintenance';
import { ServiceType } from '@/types';

const VALID_TYPES = new Set<ServiceType>(['oil_change', 'inspection', 'emissions_inspection', 'tire_rotation', 'brake_service', 'battery', 'other']);

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeString12hr(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function toTimeString24hr(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function NewLogScreen() {
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const initialType: ServiceType = typeParam && VALID_TYPES.has(typeParam as ServiceType) ? (typeParam as ServiceType) : 'oil_change';

  const { session } = useAuth();
  const { vehicle } = useVehicle(session?.user.id);
  const { addLog } = useMaintenanceLogs(vehicle?.id);
  const { addAppointment } = useAppointments(vehicle?.id);

  const [type, setType] = useState<ServiceType>(initialType);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Log-only fields
  const [mileage, setMileage] = useState('');
  const [shopName, setShopName] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  // Appointment-only fields
  const [location, setLocation] = useState('');
  const [time, setTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(date);
  selected.setHours(0, 0, 0, 0);
  const isFuture = selected > today;

  async function handleSave() {
    if (isFuture) {
      if (!location.trim()) {
        Alert.alert('Required', 'Please enter a location for the appointment.');
        return;
      }
      setLoading(true);
      try {
        await addAppointment({
          shop_name: location.trim(),
          service_type: type,
          scheduled_date: toDateString(date),
          scheduled_time: time ? toTimeString24hr(time) : undefined,
        });
        Alert.alert('Appointment Saved', 'Your appointment has been added to the Schedule tab.');
        router.back();
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        await addLog({
          type,
          date: toDateString(date),
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
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-6 pt-16 pb-8">
      <View className="flex-row items-center mb-6">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Text className="text-blue-600 text-base">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold flex-1">{isFuture ? 'Schedule Appointment' : 'New Entry'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          <Text className="text-blue-600 font-semibold text-base">
            {loading ? 'Saving...' : isFuture ? 'Schedule' : 'Save'}
          </Text>
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
      <TouchableOpacity
        className="border border-gray-300 rounded-xl px-4 py-3 mb-2"
        onPress={() => { setShowDatePicker(!showDatePicker); setShowTimePicker(false); }}
      >
        <Text className="text-base text-gray-900">{toDateString(date)}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="spinner"
          onChange={(_, selected) => { if (selected) setDate(selected); }}
        />
      )}
      <View className="mb-3" />

      {isFuture ? (
        <>
          <Text className="text-sm font-medium text-gray-600 mb-1">Location *</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base"
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Jiffy Lube on Main St"
          />

          <Text className="text-sm font-medium text-gray-400 mb-1">Time (optional)</Text>
          <TouchableOpacity
            className="border border-gray-300 rounded-xl px-4 py-3 mb-2"
            onPress={() => { setShowTimePicker(!showTimePicker); setShowDatePicker(false); }}
          >
            <Text className={`text-base ${time ? 'text-gray-900' : 'text-gray-400'}`}>
              {time ? toTimeString12hr(time) : 'Tap to select a time'}
            </Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={time ?? new Date()}
              mode="time"
              display="spinner"
              onChange={(_, selected) => { if (selected) setTime(selected); }}
            />
          )}
        </>
      ) : (
        <>
          <Text className="text-sm font-medium text-gray-400 mb-1">Mileage at service (optional)</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base"
            value={mileage}
            onChangeText={setMileage}
            placeholder="e.g. 47500"
            keyboardType="numeric"
          />

          <Text className="text-sm font-medium text-gray-400 mb-1">Shop Name (optional)</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base"
            value={shopName}
            onChangeText={setShopName}
            placeholder="e.g. Jiffy Lube"
          />

          <Text className="text-sm font-medium text-gray-400 mb-1">Cost (optional)</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base"
            value={cost}
            onChangeText={setCost}
            placeholder="e.g. 49.99"
            keyboardType="decimal-pad"
          />

          <Text className="text-sm font-medium text-gray-400 mb-1">Notes (optional)</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any notes..."
            multiline
            numberOfLines={3}
          />
        </>
      )}
    </ScrollView>
  );
}
