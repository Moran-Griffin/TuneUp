import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCATION_TASK_NAME = 'tuneup-location-task';
const DWELL_KEY = '@tuneup/dwell_start';
const DWELL_NAME_KEY = '@tuneup/dwell_name';
const DWELL_MS = 5 * 60 * 1000; // 5 minutes

const AUTO_SHOP_KEYWORDS = [
  'auto', 'car', 'motor', 'mechanic', 'tire', 'lube', 'jiffy', 'midas',
  'meineke', 'firestone', 'dealer', 'toyota', 'honda', 'ford', 'chevrolet',
  'nissan', 'bmw', 'mercedes', 'hyundai', 'kia', 'subaru', 'shop', 'garage',
];

function isAutoShop(place: Location.LocationGeocodedAddress): boolean {
  const name = (place.name ?? '').toLowerCase();
  return AUTO_SHOP_KEYWORDS.some(kw => name.includes(kw));
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations?.length) return;

  const { latitude, longitude } = locations[locations.length - 1].coords;

  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const atShop = place && isAutoShop(place);

    if (atShop) {
      const existing = await AsyncStorage.getItem(DWELL_KEY);
      if (!existing) {
        await AsyncStorage.setItem(DWELL_KEY, Date.now().toString());
        await AsyncStorage.setItem(DWELL_NAME_KEY, place.name ?? 'the shop');
      } else {
        const elapsed = Date.now() - parseInt(existing, 10);
        if (elapsed >= DWELL_MS) {
          const shopName = await AsyncStorage.getItem(DWELL_NAME_KEY);
          await AsyncStorage.removeItem(DWELL_KEY);
          await AsyncStorage.removeItem(DWELL_NAME_KEY);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Getting work done?',
              body: `You've been at ${shopName} for a bit — log your service in TuneUp?`,
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
    // Reverse geocode can fail silently
  }
});

export async function startLocationTracking(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') return false;

  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (already) return true;

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

  return true;
}
