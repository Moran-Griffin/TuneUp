import { useCallback, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Shop } from '@/types';
import {
  LatLng,
  ShopWithDistance,
  sortByDistance,
  nearbySearchRequest,
  textSearchRequest,
  placeDetailsRequest,
  parsePlaces,
  placesErrorMessage,
  PlacesRequest,
  isWebUrl,
} from '@/lib/shopSearch';
import { DETAILS_CACHE_KEY, DetailsCache, ShopDetails, cachedDetails, withCachedDetails, parseDetailsCache, detailsFromResponse } from '@/lib/shopDetailsCache';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY!;

type TextSearch = { label: string; query: string; results: ShopWithDistance[] };

async function fetchPlaces(req: PlacesRequest): Promise<Shop[]> {
  let res: Response;
  try {
    res = await fetch(req.url, req.init);
  } catch {
    throw new Error(placesErrorMessage(null));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(placesErrorMessage(data));
  return parsePlaces(data);
}

async function readDetailsCache(): Promise<DetailsCache> {
  return parseDetailsCache(await AsyncStorage.getItem(DETAILS_CACHE_KEY).catch(() => null));
}

/** Website/phone for a shop: on-device cache first, Place Details (New) only on a miss. */
async function shopDetails(placeId: string): Promise<ShopDetails> {
  const cache = await readDetailsCache();
  const hit = cachedDetails(cache, placeId, Date.now());
  if (hit) return hit;
  const req = placeDetailsRequest(placeId, API_KEY);
  const res = await fetch(req.url, req.init).catch(() => null);
  const data = res ? await res.json().catch(() => null) : null;
  const { details, cacheable } = detailsFromResponse(!!res?.ok, data);
  // Only cache real answers, so a network blip, quota error or bad body is retried next tap.
  if (cacheable) {
    await AsyncStorage.setItem(DETAILS_CACHE_KEY, JSON.stringify(withCachedDetails(cache, placeId, details, Date.now()))).catch(() => {});
  }
  return details;
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
    setNearby(sortByDistance(await fetchPlaces(nearbySearchRequest(at, API_KEY)), at));
  }, []);

  const runText = useCallback(async (label: string, query: string, at: LatLng) => {
    const results = await fetchPlaces(textSearchRequest(query, at, API_KEY));
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
      // Only http(s) links are opened or saved; anything else is treated as "no website".
      const { website, phone } = await shopDetails(shop.place_id);
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
