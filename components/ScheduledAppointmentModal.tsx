import { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { ServiceType } from '@/types';
import { SERVICE_TYPE_LABELS } from '@/constants/maintenance';

interface Props {
  visible: boolean;
  shopName: string;
  shopUrl: string | undefined;
  onYes: (data: { service_type: ServiceType; scheduled_date: string; scheduled_time?: string }) => void;
  onNo: () => void;
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

function toTimeString12hr(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function toTimeString24hr(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function ScheduledAppointmentModal({ visible, shopName, shopUrl, onYes, onNo }: Props) {
  const [serviceType, setServiceType] = useState<ServiceType>('oil_change');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [time, setTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setDate(new Date());
      setTime(null);
      setServiceType('oil_change');
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  }, [visible]);

  function handleConfirm() {
    onYes({
      service_type: serviceType,
      scheduled_date: toDateString(date),
      scheduled_time: time ? toTimeString24hr(time) : undefined,
    });
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
              minimumDate={new Date()}
            />
          )}
          <View className="mb-4" />

          <Text className="text-sm font-medium text-gray-600 mb-1">Time (optional)</Text>
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
          <View className="mb-6" />

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
