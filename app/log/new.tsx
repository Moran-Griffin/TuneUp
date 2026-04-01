import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, Platform,
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
  return d.toISOString().split('T')[0];
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
  const [mileage, setMileage] = useState('');
  const [shopName, setShopName] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Appointment modal state
  const [apptModalVisible, setApptModalVisible] = useState(false);
  const [apptDate, setApptDate] = useState(new Date());
  const [showApptDatePicker, setShowApptDatePicker] = useState(false);
  const [apptShopName, setApptShopName] = useState('');
  const [apptSaving, setApptSaving] = useState(false);

  async function saveLog() {
    setLoading(true);
    try {
      await addLog({
        type,
        date: toDateString(date),
        // mileage in the log entry is the odometer at time of service — not saved to vehicle.current_mileage
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

  function handleSave() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);

    if (selected > today) {
      Alert.alert(
        'Future Date',
        'This date is in the future. Is this a scheduled appointment, or did you mean to use today?',
        [
          {
            text: "It's an Appointment",
            onPress: () => {
              setApptDate(date);
              setApptShopName(shopName);
              setApptModalVisible(true);
            },
          },
          { text: 'Change Date', style: 'cancel' },
          { text: 'Save Anyway', onPress: saveLog },
        ]
      );
      return;
    }

    saveLog();
  }

  async function handleSaveAppointment() {
    if (!apptShopName.trim()) {
      Alert.alert('Required', 'Please enter a shop name.');
      return;
    }
    setApptSaving(true);
    try {
      await addAppointment({
        shop_name: apptShopName.trim(),
        service_type: type,
        scheduled_date: toDateString(apptDate),
      });
      setApptModalVisible(false);
      Alert.alert('Appointment Saved', 'Your appointment has been added to the Schedule tab.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setApptSaving(false);
    }
  }

  return (
    <>
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
        <TouchableOpacity
          className="border border-gray-300 rounded-xl px-4 py-3 mb-2"
          onPress={() => setShowDatePicker(!showDatePicker)}
        >
          <Text className="text-base text-gray-900">{toDateString(date)}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="spinner"
            onChange={(_, selected) => {
              if (selected) setDate(selected);
            }}
            maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() + 1))}
          />
        )}
        <View className="mb-3" />

        {(() => {
          const today = new Date(); today.setHours(0,0,0,0);
          const sel = new Date(date); sel.setHours(0,0,0,0);
          const isFuture = sel > today;
          return isFuture ? (
            <View className="border border-gray-200 rounded-xl px-4 py-3 mb-4 bg-gray-50">
              <Text className="text-gray-400 text-base">Mileage not available for future dates</Text>
            </View>
          ) : (
            <>
              <Text className="text-sm font-medium text-gray-400 mb-1">Mileage at service (optional)</Text>
              <TextInput className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base" value={mileage} onChangeText={setMileage} placeholder="e.g. 47500" keyboardType="numeric" />
            </>
          );
        })()}

        <Text className="text-sm font-medium text-gray-400 mb-1">Shop Name (optional)</Text>
        <TextInput className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base" value={shopName} onChangeText={setShopName} placeholder="e.g. Jiffy Lube" />

        <Text className="text-sm font-medium text-gray-400 mb-1">Cost (optional)</Text>
        <TextInput className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base" value={cost} onChangeText={setCost} placeholder="e.g. 49.99" keyboardType="decimal-pad" />

        <Text className="text-sm font-medium text-gray-400 mb-1">Notes (optional)</Text>
        <TextInput className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base" value={notes} onChangeText={setNotes} placeholder="Any notes..." multiline numberOfLines={3} />
      </ScrollView>

      {/* Appointment modal */}
      <Modal visible={apptModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end">
          <View className="bg-white rounded-t-2xl px-6 pt-6 pb-10 shadow-lg">
            <Text className="text-lg font-bold mb-1">Schedule Appointment</Text>
            <Text className="text-gray-500 text-sm mb-5">
              Add this as a scheduled appointment for {SERVICE_TYPE_LABELS[type]}.
            </Text>

            <Text className="text-sm font-medium text-gray-600 mb-1">Shop Name *</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base"
              value={apptShopName}
              onChangeText={setApptShopName}
              placeholder="e.g. Jiffy Lube"
            />

            <Text className="text-sm font-medium text-gray-600 mb-1">Appointment Date</Text>
            <TouchableOpacity
              className="border border-gray-300 rounded-xl px-4 py-3 mb-2"
              onPress={() => setShowApptDatePicker(!showApptDatePicker)}
            >
              <Text className="text-base text-gray-900">{toDateString(apptDate)}</Text>
            </TouchableOpacity>
            {showApptDatePicker && (
              <DateTimePicker
                value={apptDate}
                mode="date"
                display="spinner"
                onChange={(_, selected) => {
                  if (selected) setApptDate(selected);
                }}
                minimumDate={new Date()}
              />
            )}
            <View className="mb-5" />

            <TouchableOpacity
              className="bg-blue-600 rounded-xl py-4 items-center mb-3"
              onPress={handleSaveAppointment}
              disabled={apptSaving}
            >
              <Text className="text-white font-semibold text-base">
                {apptSaving ? 'Saving...' : 'Save Appointment'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setApptModalVisible(false)}>
              <Text className="text-center text-gray-500">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
