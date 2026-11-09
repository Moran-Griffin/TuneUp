import { Vehicle } from '@/types';
import { sortVehicles } from '@/lib/vehicleDisplay';

/** Keep the stored selection if it still exists, else fall back to the oldest vehicle. */
export function resolveSelectedVehicleId(vs: Vehicle[], storedId: string | null): string | null {
  if (vs.length === 0) return null;
  if (storedId && vs.some(v => v.id === storedId)) return storedId;
  return sortVehicles(vs)[0].id;
}

/** Switching UI (dropdown, overview, vehicle rows) only appears with 2+ vehicles. */
export function canSwitchVehicles(vs: Vehicle[]): boolean {
  return vs.length >= 2;
}
