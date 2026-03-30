import { View, Text, TouchableOpacity } from 'react-native';
import { MaintenanceLog } from '@/types';
import { SERVICE_TYPE_LABELS } from '@/constants/maintenance';
import { ChevronRight } from 'lucide-react-native';

interface Props {
  log: MaintenanceLog;
  onPress: () => void;
}

export function LogEntryItem({ log, onPress }: Props) {
  return (
    <TouchableOpacity
      className="flex-row items-center bg-white px-4 py-3 border-b border-gray-100"
      onPress={onPress}
    >
      <View className="flex-1">
        <Text className="font-semibold text-gray-900">{SERVICE_TYPE_LABELS[log.type]}</Text>
        <Text className="text-sm text-gray-500">
          {log.date}{log.mileage ? ` · ${log.mileage.toLocaleString()} mi` : ''}{log.shop_name ? ` · ${log.shop_name}` : ''}
        </Text>
        {log.cost ? <Text className="text-sm text-gray-400">${log.cost.toFixed(2)}</Text> : null}
      </View>
      <ChevronRight size={16} color="#9ca3af" />
    </TouchableOpacity>
  );
}
