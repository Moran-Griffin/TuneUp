import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCATION_TASK_NAME = 'tuneup-location-task';
const DWELL_KEY = '@tuneup/dwell_start';
const DWELL_NAME_KEY = '@tuneup/dwell_name';
const DWELL_MS = 5 * 60 * 1000;
const DETECTION_RADIUS_M = 100;

const PLACES_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

async function getNearbyAutoShop(lat: number, lng: number): Promise<string | null> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  const url = `${PLACES_URL}?location=${lat},${lng}&radius=${DETECTION_RADIUS_M}&type=car_repair|car_dealer&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.results?.length > 0) {
    return data.results[0].name as string;
  }
  return null;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations?.length) return;

  const { latitude, longitude } = locations[locations.length - 1].coords;

  try {
    const shopName = await getNearbyAutoShop(latitude, longitude);

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
    // Places API can fail silently
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
