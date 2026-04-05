import * as Notifications from 'expo-notifications';
import { Vehicle, ServiceType } from '@/types';
import { getOilChangeStatus, getInspectionStatus, getEmissionsStatus } from '@/lib/serviceStatus';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const SERVICE_NOTIFICATION_IDS: Partial<Record<ServiceType, string>> = {
  oil_change: 'oil_change_reminder',
  inspection: 'inspection_reminder',
  emissions_inspection: 'emissions_reminder',
};

async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelNotificationForServiceType(serviceType: ServiceType): Promise<void> {
  const id = SERVICE_NOTIFICATION_IDS[serviceType];
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export async function scheduleMaintenanceNotifications(vehicle: Vehicle): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;

  await Notifications.cancelScheduledNotificationAsync('oil_change_reminder').catch(() => {});
  await Notifications.cancelScheduledNotificationAsync('inspection_reminder').catch(() => {});
  await Notifications.cancelScheduledNotificationAsync('emissions_reminder').catch(() => {});
  await Notifications.cancelScheduledNotificationAsync('mileage_update').catch(() => {});

  const now = new Date();

  // Oil change — use dueDate if available, else estimate from interval months
  const oilStatus = getOilChangeStatus(vehicle);
  const oilFireDate: Date | null = oilStatus.dueDate
    ?? (vehicle.oil_change_interval_months
      ? new Date(now.getFullYear(), now.getMonth() + vehicle.oil_change_interval_months, now.getDate())
      : null);
  if (oilFireDate) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'oil_change_reminder',
      content: {
        title: 'Oil Change Due',
        body: 'Your oil change is due — tap to schedule or log.',
        data: { type: 'maintenance_reminder' },
      },
      trigger: oilStatus.isOverdue
        ? { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: 9, minute: 0, repeats: true }
        : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: oilFireDate },
    });
  }

  // Inspection
  const inspectionStatus = getInspectionStatus(vehicle);
  if (inspectionStatus.dueDate) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'inspection_reminder',
      content: {
        title: 'Inspection Due',
        body: 'Your safety inspection is coming up — tap to schedule or log.',
        data: { type: 'maintenance_reminder' },
      },
      trigger: inspectionStatus.isOverdue
        ? { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: 9, minute: 0, repeats: true }
        : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: inspectionStatus.dueDate },
    });
  }

  // Emissions — only if enabled
  if (vehicle.emissions_enabled) {
    const emissionsStatus = getEmissionsStatus(vehicle);
    if (emissionsStatus.dueDate) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'emissions_reminder',
        content: {
          title: 'Emissions Test Due',
          body: 'Your emissions test is coming up — tap to schedule or log.',
          data: { type: 'maintenance_reminder' },
        },
        trigger: emissionsStatus.isOverdue
          ? { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: 9, minute: 0, repeats: true }
          : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: emissionsStatus.dueDate },
      });
    }
  }

  // Monthly mileage prompt — repeats on the 1st of every month at 9am
  await Notifications.scheduleNotificationAsync({
    identifier: 'mileage_update',
    content: {
      title: 'How many miles?',
      body: "It's a new month — update your mileage in TuneUp.",
      data: { type: 'mileage_update' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      day: 1,
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });
}
