import { useState } from 'react';
import { Shop } from '@/types';

const GOOGLE_PLACES_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY!;

export function useShopSearch() {
  const [results, setResults] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchNearby(lat: number, lng: number) {
    setLoading(true);
    setError(null);
    try {
      const url = `${GOOGLE_PLACES_URL}?location=${lat},${lng}&radius=10000&type=car_repair|car_dealer&key=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(data.error_message || 'Search failed');
      }
      setResults(data.results ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return { results, loading, error, searchNearby };
}
