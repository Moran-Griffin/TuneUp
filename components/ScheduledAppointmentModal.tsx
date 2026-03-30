import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { ServiceType } from '@/types';
import { SERVICE_TYPE_LABELS } from '@/constants/maintenance';

interface Props {
  visible: boolean;
  shopName: string;
  shopUrl: string | undefined;
  onYes: (data: { service_type: ServiceType; scheduled_date: string; scheduled_time: string }) => void;
  onNo: () => void;
}

export function ScheduledAppointmentModal({ visible, shopName, shopUrl, onYes, onNo }: Props) {
  const [serviceType, setServiceType] = useState<ServiceType>('oil_change');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  function handleConfirm() {
    if (!date) return;
    onYes({ service_type: serviceType, scheduled_date: date, scheduled_time: time });
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
          <Text className="text-xl font-bold mb-1">Did you schedule an appointment?</Text>
          <Text className="text-gray-500 mb-6">at {shopName}</Text>

          <Text className="text-sm font-medium text-gray-600 mb-1">Service Type</Text>
          <View className="border border-gray-300 rounded-xl mb-4">
            <Picker selectedValue={serviceType} onValueChange={(v) => setServiceType(v as ServiceType)}>
              {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([value, label]) => (
                <Picker.Item key={value} label={label} value={value} />
              ))}
            </Picker>
          </View>

          <Text className="text-sm font-medium text-gray-600 mb-1">Date (YYYY-MM-DD) *</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base"
            value={date}
            onChangeText={setDate}
            placeholder="e.g. 2026-04-15"
          />

          <Text className="text-sm font-medium text-gray-600 mb-1">Time (optional)</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 mb-6 text-base"
            value={time}
            onChangeText={setTime}
            placeholder="e.g. 10:00 AM"
          />

          <TouchableOpacity
            className="bg-blue-600 rounded-xl py-4 items-center mb-3"
            onPress={handleConfirm}
          >
            <Text className="text-white font-semibold text-base">Yes, save appointment</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center" onPress={onNo}>
            <Text className="text-gray-500">No, not yet</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
