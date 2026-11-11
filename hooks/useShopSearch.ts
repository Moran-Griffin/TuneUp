import { useCallback, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Shop } from '@/types';
import {
  LatLng,
  ShopWithDistance,
  mergeShops,
  sortByDistance,
  nearbySearchUrls,
  textSearchUrl,
  placeDetailsUrl,
} from '@/lib/shopSearch';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY!;

type TextSearch = { label: string; query: string; results: ShopWithDistance[] };

async function fetchPlaces(url: string): Promise<Shop[]> {
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'ZERO_RESULTS') return [];
  if (data.status !== 'OK') throw new Error(`${data.status}: ${data.error_message || 'Search failed'}`);
  // Text Search returns formatted_address instead of vicinity.
  return (data.results ?? []).map((r: any) => ({ ...r, vicinity: r.vicinity ?? r.formatted_address ?? '' }));
}

async function locate(): Promise<LatLng> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location access is needed to find shops near you. Turn it on in iOS Settings → TuneUp → Location.');
  }
  const loc = await Location.getCurrentPositionAsync({});
  return { lat: loc.coords.latitude, lng: loc.coords.longitude };
}

export function useShopSearch() {
  const [nearby, setNearby] = useState<ShopWithDistance[]>([]);
  const [text, setText] = useState<TextSearch | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const origin = useRef<LatLng | null>(null);

  const runNearby = useCallback(async (at: LatLng) => {
    const lists = await Promise.all(nearbySearchUrls(at, API_KEY).map(fetchPlaces));
    setNearby(sortByDistance(mergeShops(lists), at));
  }, []);

  const runText = useCallback(async (label: string, query: string, at: LatLng) => {
    const results = await fetchPlaces(textSearchUrl(query, at, API_KEY));
    setText({ label, query, results: sortByDistance(results, at) });
  }, []);

  /** First load of nearby shops (no-op once loaded). */
  const load = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    setError(null);
    try {
      const at = await locate();
      origin.current = at;
      await runNearby(at);
      setLoaded(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [loaded, loading, runNearby]);

  /** Google Text Search near the user. `label` is what the search bar shows. */
  const search = useCallback(async (label: string, query: string = label) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const at = origin.current ?? (await locate());
      origin.current = at;
      await runText(label, query, at);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [runText]);

  const clearSearch = useCallback(() => setText(null), []);

  /** Pull-to-refresh: re-read location and re-run nearby (and the active search, if any). */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const at = await locate();
      origin.current = at;
      await Promise.all([
        runNearby(at),
        text ? runText(text.label, text.query, at) : Promise.resolve(),
      ]);
      setLoaded(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, [runNearby, runText, text]);

  /** Open the shop's website (sets up the "did you schedule?" prompt), or offer call/maps. */
  const openShop = useCallback(async (shop: Shop) => {
    if (openingId) return;
    setOpeningId(shop.place_id);
    try {
      let website = shop.website;
      let phone: string | undefined;
      if (!website) {
        const data = await fetch(placeDetailsUrl(shop.place_id, API_KEY)).then(r => r.json()).catch(() => null);
        website = data?.result?.website ?? undefined;
        phone = data?.result?.formatted_phone_number ?? undefined;
      }
      if (website) {
        await AsyncStorage.setItem('pendingShop', JSON.stringify({ ...shop, website }));
        await Linking.openURL(website);
        return;
      }
      const { lat, lng } = shop.geometry.location;
      Alert.alert('No Website Listed', `${shop.name} doesn't list a website. Call them to book.`, [
        ...(phone ? [{ text: `Call ${phone}`, onPress: () => Linking.openURL(`tel:${phone!.replace(/[^\d+]/g, '')}`) }] : []),
        { text: 'Open in Maps', onPress: () => Linking.openURL(`maps://?q=${encodeURIComponent(shop.name)}&ll=${lat},${lng}`) },
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    } finally {
      setOpeningId(null);
    }
  }, [openingId]);

  return { nearby, text, loaded, loading, refreshing, error, openingId, load, search, clearSearch, refresh, openShop };
}
