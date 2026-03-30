import { View, Text, TouchableOpacity } from 'react-native';
import { Shop } from '@/types';
import { ChevronRight, Star } from 'lucide-react-native';

interface Props {
  shop: Shop;
  onPress: () => void;
}

export function ShopListItem({ shop, onPress }: Props) {
  return (
    <TouchableOpacity
      className="flex-row items-center bg-white px-4 py-3 border-b border-gray-100"
      onPress={onPress}
    >
      <View className="flex-1">
        <Text className="font-semibold text-gray-900">{shop.name}</Text>
        <Text className="text-sm text-gray-500">{shop.vicinity}</Text>
        {shop.rating ? (
          <View className="flex-row items-center mt-1">
            <Star size={12} color="#f59e0b" />
            <Text className="text-xs text-gray-400 ml-1">{shop.rating}</Text>
          </View>
        ) : null}
      </View>
      <ChevronRight size={16} color="#9ca3af" />
    </TouchableOpacity>
  );
}
