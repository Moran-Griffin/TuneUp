import { View, Text, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Appointment } from '@/types';
import { SERVICE_TYPE_LABELS } from '@/constants/maintenance';
import { Calendar } from 'lucide-react-native';

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

interface Props {
  appointment: Appointment;
  onCancel?: () => void;
  onComplete?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function AppointmentItem({ appointment, onCancel, onComplete, isFirst, isLast }: Props) {
  const { colorScheme: scheme } = useColorScheme();
  const roundedTop = isFirst ? 'rounded-t-2xl' : '';
  const roundedBottom = isLast ? 'rounded-b-2xl' : '';
  const borderBottom = isLast ? '' : 'border-b border-gray-100 dark:border-[#3a3a3c]';
  return (
    <View className={`flex-row items-center bg-white dark:bg-[#2c2c2e] px-4 py-3 ${roundedTop} ${roundedBottom} ${borderBottom}`}>
      <Calendar size={18} color={scheme === 'dark' ? '#0a84ff' : '#2563eb'} />
      <View className="flex-1 ml-3">
        <Text className="font-semibold text-gray-900 dark:text-white">{SERVICE_TYPE_LABELS[appointment.service_type]}</Text>
        <Text className="text-sm text-gray-500 dark:text-[#8e8e93]">
          {appointment.shop_name} · {formatDate(appointment.scheduled_date)}
          {appointment.scheduled_time ? ` at ${new Date(`1970-01-01T${appointment.scheduled_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : ''}
        </Text>
      </View>
      <View className="flex-row gap-3">
        {onComplete && (
          <TouchableOpacity onPress={onComplete}>
            <Text className="text-green-600 dark:text-[#30d158] text-sm font-medium">Done</Text>
          </TouchableOpacity>
        )}
        {onCancel && (
          <TouchableOpacity onPress={onCancel}>
            <Text className="text-red-400 dark:text-[#ff453a] text-sm">Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
