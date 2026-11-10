import { Vehicle } from '@/types';
import { getOilChangeStatus, getInspectionStatus, getEmissionsStatus } from '@/lib/serviceStatus';
import { sortVehicles, vehicleDisplayName } from '@/lib/vehicleDisplay';

// Pure description of the local notifications TuneUp should have scheduled.
// No expo imports: trigger types are the string values of
// Notifications.SchedulableTriggerInputTypes ('date' / 'calendar').

export type ReminderService = 'oil_change' | 'inspection' | 'emissions_inspection';

export type PlannedTrigger =
  | { type: 'date'; date: Date }
  | { type: 'calendar'; hour: number; minute: number; day?: number; repeats: true };

export type PlannedNotification = {
  identifier: string;
  content: { title: string; body: string; data: Record<string, unknown> };
  trigger: PlannedTrigger;
};

export const MILEAGE_NOTIFICATION_ID = 'mileage_update';

const SUFFIX: Record<ReminderService, string> = {
  oil_change: 'oil_change_reminder',
  inspection: 'inspection_reminder',
  emissions_inspection: 'emissions_reminder',
};

const LEGACY_IDS = new Set(Object.values(SUFFIX));

export function maintenanceNotificationId(vehicleId: string, service: ReminderService): string {
  return `${vehicleId}:${SUFFIX[service]}`;
}

/** True for any maintenance reminder id, including the pre-multi-vehicle fixed ids. */
export function isMaintenanceNotificationId(id: string): boolean {
  if (LEGACY_IDS.has(id)) return true;
  const sep = id.lastIndexOf(':');
  return sep > 0 && LEGACY_IDS.has(id.slice(sep + 1));
}

const DAILY_9AM: PlannedTrigger = { type: 'calendar', hour: 9, minute: 0, repeats: true };

function reminder(
  vehicle: Vehicle,
  name: string,
  service: ReminderService,
  title: string,
  body: string,
  trigger: PlannedTrigger
): PlannedNotification {
  return {
    identifier: maintenanceNotificationId(vehicle.id, service),
    content: { title: `${title}: ${name}`, body, data: { type: 'maintenance_reminder', vehicleId: vehicle.id } },
    trigger,
  };
}

function vehiclePlan(vehicle: Vehicle, name: string, now: Date): PlannedNotification[] {
  const out: PlannedNotification[] = [];

  // Oil change — use dueDate if available, else estimate from interval months
  const oil = getOilChangeStatus(vehicle);
  const oilFireDate: Date | null = oil.dueDate
    ?? (vehicle.oil_change_interval_months
      ? new Date(now.getFullYear(), now.getMonth() + vehicle.oil_change_interval_months, now.getDate())
      : null);
  if (oilFireDate) {
    out.push(reminder(vehicle, name, 'oil_change', 'Oil Change Due',
      'Your oil change is due — tap to schedule or log.',
      oil.isOverdue ? DAILY_9AM : { type: 'date', date: oilFireDate }));
  }

  const inspection = getInspectionStatus(vehicle);
  if (inspection.dueDate) {
    out.push(reminder(vehicle, name, 'inspection', 'Inspection Due',
      'Your safety inspection is coming up — tap to schedule or log.',
      inspection.isOverdue ? DAILY_9AM : { type: 'date', date: inspection.dueDate }));
  }

  if (vehicle.emissions_enabled) {
    const emissions = getEmissionsStatus(vehicle);
    if (emissions.dueDate) {
      out.push(reminder(vehicle, name, 'emissions_inspection', 'Emissions Test Due',
        'Your emissions test is coming up — tap to schedule or log.',
        emissions.isOverdue ? DAILY_9AM : { type: 'date', date: emissions.dueDate }));
    }
  }

  return out;
}

export function buildNotificationPlan(vehicles: Vehicle[], now: Date): PlannedNotification[] {
  if (vehicles.length === 0) return [];
  const plan = sortVehicles(vehicles).flatMap(v => vehiclePlan(v, vehicleDisplayName(v, vehicles), now));
  plan.push({
    identifier: MILEAGE_NOTIFICATION_ID,
    content: {
      title: 'How many miles?',
      body: "It's a new month — update your mileage in TuneUp.",
      data: { type: 'mileage_update' },
    },
    trigger: { type: 'calendar', day: 1, hour: 9, minute: 0, repeats: true },
  });
  return plan;
}
