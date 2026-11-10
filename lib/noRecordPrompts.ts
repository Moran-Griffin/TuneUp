import { Vehicle } from '@/types';

export type NoRecordService = 'oil' | 'inspection' | 'emissions';

export function noRecordPromptKey(vehicleId: string, service: NoRecordService): string {
  return `${vehicleId}:${service}`;
}

/**
 * Services with no record (and no due-date override) that haven't been prompted
 * for this vehicle yet. Marks them in `prompted` so each vehicle is asked once
 * per session, even when switching between vehicles.
 */
export function takeNoRecordPrompts(vehicle: Vehicle, prompted: Set<string>): NoRecordService[] {
  const missing: NoRecordService[] = [];
  if (!vehicle.last_oil_change_date && !vehicle.last_oil_change_mileage
    && vehicle.oil_due_mileage_override == null && vehicle.oil_due_date_override == null) {
    missing.push('oil');
  }
  if (!vehicle.last_inspection_date && vehicle.inspection_due_date_override == null) {
    missing.push('inspection');
  }
  if (vehicle.emissions_enabled && !vehicle.last_emissions_date && vehicle.emissions_due_date_override == null) {
    missing.push('emissions');
  }
  const fresh = missing.filter(s => !prompted.has(noRecordPromptKey(vehicle.id, s)));
  fresh.forEach(s => prompted.add(noRecordPromptKey(vehicle.id, s)));
  return fresh;
}
