import { haversineMiles, LatLng } from '@/lib/shopSearch';

// Decides whether the background "are you at a shop?" check needs a Places
// request, or can reuse the last answer. Pure; locationTask.ts applies it.

export const DWELL_LOOKUP = {
  /** Faster than this (m/s, ~4.5 mph) means driving/passing by: no lookup. */
  maxSpeedMps: 2,
  /** Never look up more often than this. */
  minGapMs: 3 * 60_000,
  /** Reuse the last answer while within this distance of where it was taken... */
  reuseRadiusM: 75,
  /** ...and it is younger than this. */
  reuseWindowMs: 15 * 60_000,
} as const;

export type LastDwellCheck = { at: number; lat: number; lng: number; shopName: string | null };

export type DwellDecision =
  | { kind: 'moving' }
  | { kind: 'reuse'; shopName: string | null }
  | { kind: 'lookup' };

const METERS_PER_MILE = 1609.344;

export function dwellDecision(input: { now: number; at: LatLng; speed: number | null | undefined; last: LastDwellCheck | null }): DwellDecision {
  const { now, at, speed, last } = input;
  if (typeof speed === 'number' && speed > DWELL_LOOKUP.maxSpeedMps) return { kind: 'moving' };
  if (last) {
    const age = now - last.at;
    if (age < DWELL_LOOKUP.minGapMs) return { kind: 'reuse', shopName: last.shopName };
    const movedM = haversineMiles(at, { lat: last.lat, lng: last.lng }) * METERS_PER_MILE;
    if (age < DWELL_LOOKUP.reuseWindowMs && movedM <= DWELL_LOOKUP.reuseRadiusM) return { kind: 'reuse', shopName: last.shopName };
  }
  return { kind: 'lookup' };
}
