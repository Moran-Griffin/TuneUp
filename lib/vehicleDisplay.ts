import { Vehicle } from '@/types';

/** Vehicles in creation order (oldest first). Does not mutate the input. */
export function sortVehicles(vs: Vehicle[]): Vehicle[] {
  return [...vs].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function baseName(v: Vehicle): string {
  const nickname = v.nickname?.trim();
  return nickname ? `${nickname} (${v.year})` : `${v.year} ${v.make} ${v.model}`;
}

/**
 * Human-readable vehicle name. Pass `all` (the user's full vehicle list) to
 * disambiguate identical names: later-created duplicates get " #2", " #3", …
 */
export function vehicleDisplayName(v: Vehicle, all?: Vehicle[]): string {
  const name = baseName(v);
  if (!all) return name;
  const same = sortVehicles(all).filter(o => baseName(o) === name);
  const index = same.findIndex(o => o.id === v.id);
  return index > 0 ? `${name} #${index + 1}` : name;
}
