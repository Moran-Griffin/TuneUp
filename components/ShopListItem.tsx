import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColorScheme } from 'nativewind';
import { ExternalLink, Star } from 'lucide-react-native';
import { ShopWithDistance, formatMiles } from '@/lib/shopSearch';

interface Props {
  shop: ShopWithDistance;
  opening?: boolean;
  onPress: () => void;
}

export function ShopListItem({ shop, opening, onPress }: Props) {
  const { colorScheme: scheme } = useColorScheme();
  const distance = formatMiles(shop.distanceMiles);
  return (
    <TouchableOpacity
      className="flex-row items-center bg-white dark:bg-[#2c2c2e] px-4 py-3 border-b border-gray-100 dark:border-[#3a3a3c]"
      onPress={onPress}
      disabled={opening}
      accessibilityRole="link"
      accessibilityLabel={`${shop.name}, ${distance} away. Opens website.`}
    >
      <View className="flex-1 mr-3">
        <Text className="font-semibold text-gray-900 dark:text-white">{shop.name}</Text>
        <Text className="text-sm text-gray-500 dark:text-[#8e8e93]">{shop.vicinity}</Text>
        {shop.rating ? (
          <View className="flex-row items-center mt-1">
            <Star size={12} color="#f59e0b" />
            <Text className="text-xs text-gray-400 dark:text-[#636366] ml-1">{shop.rating}</Text>
          </View>
        ) : null}
      </View>
      <View className="items-end">
        <Text className="text-sm font-medium text-gray-700 dark:text-[#d1d1d6] mb-1">{distance}</Text>
        {opening
          ? <ActivityIndicator size="small" color={scheme === 'dark' ? '#0a84ff' : '#2563eb'} />
          : <ExternalLink size={14} color={scheme === 'dark' ? '#636366' : '#9ca3af'} />}
      </View>
    </TouchableOpacity>
  );
}
