import { View, Text, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Shop } from '@/types';
import { ChevronRight, Star } from 'lucide-react-native';

interface Props {
  shop: Shop;
  onPress: () => void;
}

export function ShopListItem({ shop, onPress }: Props) {
  const { colorScheme: scheme } = useColorScheme();
  return (
    <TouchableOpacity
      className="flex-row items-center bg-white dark:bg-[#2c2c2e] px-4 py-3 border-b border-gray-100 dark:border-[#3a3a3c]"
      onPress={onPress}
    >
      <View className="flex-1">
        <Text className="font-semibold text-gray-900 dark:text-white">{shop.name}</Text>
        <Text className="text-sm text-gray-500 dark:text-[#8e8e93]">{shop.vicinity}</Text>
        {shop.rating ? (
          <View className="flex-row items-center mt-1">
            <Star size={12} color="#f59e0b" />
            <Text className="text-xs text-gray-400 dark:text-[#636366] ml-1">{shop.rating}</Text>
          </View>
        ) : null}
      </View>
      <ChevronRight size={16} color={scheme === 'dark' ? '#636366' : '#9ca3af'} />
    </TouchableOpacity>
  );
}
