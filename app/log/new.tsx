import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { CustomLabelInput } from '@/components/CustomLabelInput';
import { MenuView } from '@react-native-menu/menu';
import { ChevronDown } from 'lucide-react-native';
import { useVehicles } from '@/hooks/VehicleContext';
import { vehicleDisplayName } from '@/lib/vehicleDisplay';
import { canSwitchVehicles } from '@/lib/vehicleSelection';
import { normalizeCustomLabel, recentCustomLabels } from '@/lib/serviceLabel';
import { useColorScheme } from 'nativewind';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/hooks/useAuth';
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

function toDisplayDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
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

  const { colorScheme: scheme } = useColorScheme();
  const { session } = useAuth();
  const { vehicles, selectedId } = useVehicles();
  // Defaults to the selected vehicle; the Vehicle row can retarget this entry.
  const [vehicleId, setVehicleId] = useState<string | null>(selectedId);
  useEffect(() => {
    if (!vehicleId && selectedId) setVehicleId(selectedId);
  }, [vehicleId, selectedId]);
  const vehicle = vehicles.find(v => v.id === vehicleId) ?? null;
  const { logs, addLog } = useMaintenanceLogs(vehicle?.id);
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
  const [customLabel, setCustomLabel] = useState('');

  // Appointment-only fields
  const [location, setLocation] = useState('');
  const [time, setTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(date);
  selected.setHours(0, 0, 0, 0);
  const isFuture = selected > today;

  const vehicleYear = vehicle?.year ? parseInt(vehicle.year, 10) : null;
  const minimumDate = vehicleYear ? new Date(vehicleYear, 0, 1) : undefined;

  const pickerStyle = scheme === 'dark' ? { color: '#ffffff', backgroundColor: '#2c2c2e' } : {};

  async function handleSave() {
    if (vehicleYear && date.getFullYear() < vehicleYear) {
      Alert.alert('Invalid Date', `Service date cannot be before your vehicle's model year (${vehicleYear}).`);
      return;
    }
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
          custom_label: normalizeCustomLabel(type, customLabel),
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
          custom_label: normalizeCustomLabel(type, customLabel),
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
    <FormScrollView className="flex-1 bg-white dark:bg-[#1c1c1e]" contentContainerClassName="px-6 pt-16 pb-8">
      <View className="flex-row items-center mb-6">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Text className="text-blue-600 dark:text-[#0a84ff] text-base">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold dark:text-white flex-1">{isFuture ? 'Schedule Appointment' : 'New Entry'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          <Text className="text-blue-600 dark:text-[#0a84ff] font-semibold text-base">
            {loading ? 'Saving...' : isFuture ? 'Schedule' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {vehicle && canSwitchVehicles(vehicles) && (
        <>
          <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">Vehicle</Text>
          <MenuView
            actions={vehicles.map(v => ({
              id: v.id,
              title: vehicleDisplayName(v, vehicles),
              state: (v.id === vehicle.id ? 'on' : 'off') as 'on' | 'off',
            }))}
            onPressAction={({ nativeEvent }) => setVehicleId(nativeEvent.event)}
          >
            <View
              className="flex-row items-center justify-between border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4"
              accessibilityRole="button"
              accessibilityLabel={`Vehicle: ${vehicleDisplayName(vehicle, vehicles)}. Change vehicle`}
            >
              <Text className="text-base text-gray-900 dark:text-white flex-1" numberOfLines={1}>{vehicleDisplayName(vehicle, vehicles)}</Text>
              <ChevronDown size={18} color={scheme === 'dark' ? '#8e8e93' : '#6b7280'} />
            </View>
          </MenuView>
        </>
      )}

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
      {type === 'other' && (
        <CustomLabelInput value={customLabel} onChangeText={setCustomLabel} suggestions={recentCustomLabels(logs)} />
      )}

      <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">Date *</Text>
      <TouchableOpacity
        className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-2"
        onPress={() => { setShowDatePicker(!showDatePicker); setShowTimePicker(false); }}
      >
        <Text className="text-base text-gray-900 dark:text-white">{toDisplayDate(date)}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          minimumDate={minimumDate}
          onChange={(_, selected) => { if (selected) setDate(selected); }}
        />
      )}
      <View className="mb-3" />

      {isFuture ? (
        <>
          <Text className="text-sm font-medium text-gray-600 dark:text-[#8e8e93] mb-1">Location *</Text>
          <TextInput
            className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Jiffy Lube on Main St"
            placeholderTextColor={scheme === 'dark' ? '#636366' : '#9ca3af'}
          />

          <Text className="text-sm font-medium text-gray-400 dark:text-[#636366] mb-1">Time (optional)</Text>
          <TouchableOpacity
            className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-2"
            onPress={() => { setShowTimePicker(!showTimePicker); setShowDatePicker(false); }}
          >
            <Text className={`text-base ${time ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-[#636366]'}`}>
              {time ? toTimeString12hr(time) : 'Tap to select a time'}
            </Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={time ?? new Date()}
              mode="time"
              display="spinner"
              is24Hour={false}
              onChange={(_, selected) => { if (selected) setTime(selected); }}
            />
          )}
        </>
      ) : (
        <>
          <Text className="text-sm font-medium text-gray-400 dark:text-[#636366] mb-1">Mileage at service (optional)</Text>
          <TextInput
            className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
            value={mileage}
            onChangeText={setMileage}
            placeholder="e.g. 47500"
            placeholderTextColor={scheme === 'dark' ? '#636366' : '#9ca3af'}
            keyboardType="numeric"
          />

          <Text className="text-sm font-medium text-gray-400 dark:text-[#636366] mb-1">Shop Name (optional)</Text>
          <TextInput
            className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
            value={shopName}
            onChangeText={setShopName}
            placeholder="e.g. Jiffy Lube"
            placeholderTextColor={scheme === 'dark' ? '#636366' : '#9ca3af'}
          />

          <Text className="text-sm font-medium text-gray-400 dark:text-[#636366] mb-1">Cost (optional)</Text>
          <TextInput
            className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
            value={cost}
            onChangeText={setCost}
            placeholder="e.g. 49.99"
            placeholderTextColor={scheme === 'dark' ? '#636366' : '#9ca3af'}
            keyboardType="decimal-pad"
          />

          <Text className="text-sm font-medium text-gray-400 dark:text-[#636366] mb-1">Notes (optional)</Text>
          <TextInput
            className="border border-gray-300 dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] rounded-xl px-4 py-3 mb-4 text-base text-gray-900 dark:text-white"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any notes..."
            placeholderTextColor={scheme === 'dark' ? '#636366' : '#9ca3af'}
            multiline
            numberOfLines={3}
          />
        </>
      )}
    </FormScrollView>
  );
}
