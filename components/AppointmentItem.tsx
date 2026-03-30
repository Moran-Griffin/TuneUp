import { View, Text, TouchableOpacity } from 'react-native';
import { Appointment } from '@/types';
import { SERVICE_TYPE_LABELS } from '@/constants/maintenance';
import { Calendar } from 'lucide-react-native';

interface Props {
  appointment: Appointment;
  onCancel?: () => void;
  onComplete?: () => void;
}

export function AppointmentItem({ appointment, onCancel, onComplete }: Props) {
  return (
    <View className="flex-row items-center bg-white px-4 py-3 border-b border-gray-100">
      <Calendar size={18} color="#2563eb" />
      <View className="flex-1 ml-3">
        <Text className="font-semibold text-gray-900">{SERVICE_TYPE_LABELS[appointment.service_type]}</Text>
        <Text className="text-sm text-gray-500">
          {appointment.shop_name} · {appointment.scheduled_date}
          {appointment.scheduled_time ? ` at ${appointment.scheduled_time}` : ''}
        </Text>
      </View>
      <View className="flex-row gap-3">
        {onComplete && (
          <TouchableOpacity onPress={onComplete}>
            <Text className="text-green-600 text-sm font-medium">Done</Text>
          </TouchableOpacity>
        )}
        {onCancel && (
          <TouchableOpacity onPress={onCancel}>
            <Text className="text-red-400 text-sm">Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
