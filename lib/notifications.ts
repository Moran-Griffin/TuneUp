import * as Notifications from 'expo-notifications';
import { Vehicle, ServiceType } from '@/types';
import {
  buildNotificationPlan,
  isMaintenanceNotificationId,
  maintenanceNotificationId,
  MILEAGE_NOTIFICATION_ID,
  PlannedNotification,
  ReminderService,
} from '@/lib/notificationPlan';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function toTrigger(t: PlannedNotification['trigger']): Notifications.NotificationTriggerInput {
  if (t.type === 'date') {
    return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t.date };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    hour: t.hour,
    minute: t.minute,
    ...(t.day !== undefined ? { day: t.day } : {}),
    repeats: t.repeats,
  };
}

// Serialize reschedules so overlapping calls can't interleave cancel/schedule.
let chain: Promise<void> = Promise.resolve();

/** Cancel every TuneUp reminder (incl. legacy ids) and schedule the full plan for these vehicles. */
export function scheduleAllNotifications(vehicles: Vehicle[]): Promise<void> {
  const run = async () => {
    const granted = await requestPermissions();
    if (!granted) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(n => isMaintenanceNotificationId(n.identifier) || n.identifier === MILEAGE_NOTIFICATION_ID)
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
    );

    for (const p of buildNotificationPlan(vehicles, new Date())) {
      await Notifications.scheduleNotificationAsync({
        identifier: p.identifier,
        content: p.content,
        trigger: toTrigger(p.trigger),
      });
    }
  };
  chain = chain.then(run, run);
  return chain;
}

const REMINDER_SERVICES = new Set<ServiceType>(['oil_change', 'inspection', 'emissions_inspection']);

/** Cancel one vehicle's reminder for a service (e.g. after booking an appointment for it). */
export async function cancelVehicleServiceNotification(vehicleId: string, service: ServiceType): Promise<void> {
  if (!REMINDER_SERVICES.has(service)) return;
  await Notifications.cancelScheduledNotificationAsync(
    maintenanceNotificationId(vehicleId, service as ReminderService)
  ).catch(() => {});
}

/** @deprecated Removed in the VehicleProvider refactor; use scheduleAllNotifications. */
export function scheduleMaintenanceNotifications(vehicle: Vehicle): Promise<void> {
  return scheduleAllNotifications([vehicle]);
}

/** @deprecated Removed in the VehicleProvider refactor; use cancelVehicleServiceNotification. */
export async function cancelNotificationForServiceType(serviceType: ServiceType): Promise<void> {
  if (!REMINDER_SERVICES.has(serviceType)) return;
  await Notifications.cancelScheduledNotificationAsync(
    maintenanceNotificationId('', serviceType as ReminderService).slice(1)
  ).catch(() => {});
}
