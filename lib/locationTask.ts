import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nearbySearchRequest, parsePlaceNames } from '@/lib/shopSearch';
import { dwellDecision, LastDwellCheck } from '@/lib/dwellThrottle';

export const LOCATION_TASK_NAME = 'tuneup-location-task';
const DWELL_KEY = '@tuneup/dwell_start';
const DWELL_NAME_KEY = '@tuneup/dwell_name';
const LAST_CHECK_KEY = '@tuneup/dwell_last_check';
const DWELL_MS = 5 * 60 * 1000;
const DETECTION_RADIUS_M = 100;

/** Nearest repair shop or dealer within 100 m, name only (Nearby Search Pro SKU). */
async function getNearbyAutoShop(lat: number, lng: number): Promise<string | null> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  const req = nearbySearchRequest({ lat, lng }, apiKey, { radiusM: DETECTION_RADIUS_M, maxResults: 1, fieldMask: 'places.displayName' });
  const res = await fetch(req.url, req.init);
  if (!res.ok) throw new Error(`Places ${res.status}`);
  return parsePlaceNames(await res.json())[0] ?? null;
}

// In-memory copy of the last check, so a storage write failure can't make every
// location update trigger a new request while the task stays alive.
let lastCheckMemo: LastDwellCheck | null = null;

async function readLastCheck(): Promise<LastDwellCheck | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_CHECK_KEY);
    const stored = raw ? (JSON.parse(raw) as LastDwellCheck) : null;
    if (stored && typeof stored.at === 'number' && (!lastCheckMemo || stored.at >= lastCheckMemo.at)) return stored;
  } catch {
    // fall through to the in-memory copy
  }
  return lastCheckMemo;
}

/** Shop name at this spot, using the throttle so most updates make no request. null = not at a shop or moving. */
async function shopAt(lat: number, lng: number, speed: number | null): Promise<string | null> {
  const now = Date.now();
  const decision = dwellDecision({ now, at: { lat, lng }, speed, last: await readLastCheck() });
  if (decision.kind === 'moving') return null;
  if (decision.kind === 'reuse') return decision.shopName;
  let shopName: string | null = null;
  try {
    shopName = await getNearbyAutoShop(lat, lng);
  } catch {
    // Network/quota failure: record it as "no shop" so we wait the minimum gap before retrying.
  }
  const check: LastDwellCheck = { at: now, lat, lng, shopName };
  lastCheckMemo = check;
  await AsyncStorage.setItem(LAST_CHECK_KEY, JSON.stringify(check)).catch(() => {});
  return shopName;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations?.length) return;

  const { latitude, longitude, speed } = locations[locations.length - 1].coords;

  try {
    const shopName = await shopAt(latitude, longitude, speed);

    if (shopName) {
      const existing = await AsyncStorage.getItem(DWELL_KEY);
      if (!existing) {
        await AsyncStorage.setItem(DWELL_KEY, Date.now().toString());
        await AsyncStorage.setItem(DWELL_NAME_KEY, shopName);
      } else {
        const elapsed = Date.now() - parseInt(existing, 10);
        if (elapsed >= DWELL_MS) {
          const savedName = await AsyncStorage.getItem(DWELL_NAME_KEY);
          await AsyncStorage.removeItem(DWELL_KEY);
          await AsyncStorage.removeItem(DWELL_NAME_KEY);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Getting work done?',
              body: `You've been at ${savedName} for a bit — log your service in TuneUp?`,
              data: { type: 'location_prompt' },
            },
            trigger: null,
          });
        }
      }
    } else {
      await AsyncStorage.removeItem(DWELL_KEY);
      await AsyncStorage.removeItem(DWELL_NAME_KEY);
    }
  } catch (_) {
    // Storage/notification failures are non-fatal for a background tick.
  }
});

export async function startLocationTracking(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') return false;

  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (already) return true;

  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60_000,
      distanceInterval: 50,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'TuneUp',
        notificationBody: 'Watching for nearby auto shops',
        notificationColor: '#2563eb',
      },
    });
  } catch (e) {
    console.warn('Failed to start location updates:', e);
    return false;
  }

  return true;
}
