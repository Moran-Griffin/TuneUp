import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Shop } from '@/types';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY!;

export default function ShopDetailScreen() {
  const { shop: shopJson } = useLocalSearchParams<{ shop: string }>();
  const shop: Shop = JSON.parse(shopJson);

  const [website, setWebsite] = useState<string | undefined>(shop.website);
  const [loadingDetails, setLoadingDetails] = useState(!shop.website);

  useEffect(() => {
    if (shop.website) return;
    fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${shop.place_id}&fields=website&key=${API_KEY}`)
      .then(r => r.json())
      .then(data => {
        setWebsite(data.result?.website ?? undefined);
      })
      .catch(() => {})
      .finally(() => setLoadingDetails(false));
  }, [shop.place_id]);

  async function handleBook() {
    if (website) {
      await AsyncStorage.setItem('pendingShop', JSON.stringify({ ...shop, website }));
      Linking.openURL(website);
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
        {loadingDetails ? (
          <View className="py-4 items-center">
            <ActivityIndicator color="#2563eb" />
          </View>
        ) : (
          <>
            <TouchableOpacity
              className="bg-blue-600 rounded-xl py-4 items-center"
              onPress={handleBook}
              disabled={!website}
            >
              <Text className="text-white font-semibold text-base">
                {website ? 'Book Appointment' : 'No Website Available'}
              </Text>
            </TouchableOpacity>
            {!website && (
              <Text className="text-center text-gray-400 text-sm mt-2">Call to book instead</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}
