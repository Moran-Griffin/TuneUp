import { useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, AppState } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin, Globe } from 'lucide-react-native';
import { Shop } from '@/types';

export default function ShopDetailScreen() {
  const { shop: shopJson } = useLocalSearchParams<{ shop: string }>();
  const shop: Shop = JSON.parse(shopJson);
  const didOpenBrowser = useRef(false);

  function handleBook() {
    if (shop.website) {
      didOpenBrowser.current = true;
      Linking.openURL(shop.website);
    }
  }

  return (
    <View className="flex-1 bg-white">
      <View className="pt-16 px-4 pb-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Text className="text-blue-600">← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold">{shop.name}</Text>
      </View>

      <View className="px-4 pt-6 gap-4">
        <View className="flex-row items-start gap-3">
          <MapPin size={18} color="#6b7280" />
          <Text className="text-gray-600 flex-1">{shop.vicinity}</Text>
        </View>

        {shop.rating ? (
          <Text className="text-gray-500">Rating: {shop.rating} / 5</Text>
        ) : null}
      </View>

      <View className="px-4 mt-8">
        <TouchableOpacity
          className="bg-blue-600 rounded-xl py-4 items-center"
          onPress={handleBook}
          disabled={!shop.website}
        >
          <Text className="text-white font-semibold text-base">
            {shop.website ? 'Book Appointment' : 'No Website Available'}
          </Text>
        </TouchableOpacity>
        {!shop.website && (
          <Text className="text-center text-gray-400 text-sm mt-2">Call to book instead</Text>
        )}
      </View>
    </View>
  );
}
