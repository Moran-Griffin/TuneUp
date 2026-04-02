import { View, Text, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import { MaintenanceLog } from '@/types';
import { SERVICE_TYPE_LABELS } from '@/constants/maintenance';
import { ChevronRight } from 'lucide-react-native';

interface Props {
  log: MaintenanceLog;
  onPress: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function LogEntryItem({ log, onPress, isFirst, isLast }: Props) {
  const { colorScheme: scheme } = useColorScheme();
  const roundedTop = isFirst ? 'rounded-t-2xl' : '';
  const roundedBottom = isLast ? 'rounded-b-2xl' : '';
  const borderBottom = isLast ? '' : 'border-b border-gray-100 dark:border-[#3a3a3c]';

  return (
    <TouchableOpacity
      className={`flex-row items-center bg-white dark:bg-[#2c2c2e] px-4 py-3 ${roundedTop} ${roundedBottom} ${borderBottom}`}
      onPress={onPress}
    >
      <View className="flex-1">
        <Text className="font-semibold text-gray-900 dark:text-white">{SERVICE_TYPE_LABELS[log.type]}</Text>
        <Text className="text-sm text-gray-500 dark:text-[#8e8e93]">
          {log.date}{log.mileage ? ` · ${log.mileage.toLocaleString()} mi` : ''}{log.shop_name ? ` · ${log.shop_name}` : ''}
        </Text>
        {log.cost ? <Text className="text-sm text-gray-400 dark:text-[#636366]">${log.cost.toFixed(2)}</Text> : null}
      </View>
      <ChevronRight size={16} color={scheme === 'dark' ? '#636366' : '#9ca3af'} />
    </TouchableOpacity>
  );
}
