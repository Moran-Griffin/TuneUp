import { Shop } from '@/types';

// Pure helpers for Find a Shop. No React, no fetch.

export type LatLng = { lat: number; lng: number };
export type ShopWithDistance = Shop & { distanceMiles: number };

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
const EARTH_RADIUS_MILES = 3958.8;
/** Text Search location bias radius (meters, ~15 mi). */
const TEXT_SEARCH_RADIUS_M = 25000;

/** Legacy Nearby Search accepts exactly one `type`; multi-type lists are ignored. */
const NEARBY_TYPES = ['car_repair', 'car_dealer'] as const;

export const SHOP_CHIPS: readonly { label: string; query: string }[] = [
  { label: 'Oil change', query: 'oil change' },
  { label: 'Tires', query: 'tire shop' },
  { label: 'Inspection', query: 'state vehicle inspection' },
  { label: 'Dealer', query: 'car dealership service center' },
];

/** Straight-line distance in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatMiles(miles: number): string {
  if (miles >= 10) return `${Math.round(miles)} mi`;
  return `${Math.max(0.1, Math.round(miles * 10) / 10).toFixed(1)} mi`;
}

/** Concatenate result lists, keeping the first occurrence of each place_id. */
export function mergeShops(lists: Shop[][]): Shop[] {
  const seen = new Set<string>();
  const out: Shop[] = [];
  for (const list of lists) {
    for (const s of list) {
      if (seen.has(s.place_id)) continue;
      seen.add(s.place_id);
      out.push(s);
    }
  }
  return out;
}

export function sortByDistance(shops: Shop[], origin: LatLng): ShopWithDistance[] {
  return shops
    .map(s => ({ ...s, distanceMiles: haversineMiles(origin, s.geometry.location) }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

/** Instant local filter on name or address. */
export function filterShops<T extends Shop>(shops: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return shops;
  return shops.filter(s => s.name.toLowerCase().includes(q) || (s.vicinity ?? '').toLowerCase().includes(q));
}

export function nearbySearchUrls(origin: LatLng, key: string): string[] {
  return NEARBY_TYPES.map(
    type => `${PLACES_BASE}/nearbysearch/json?location=${origin.lat},${origin.lng}&rankby=distance&type=${type}&key=${key}`
  );
}

export function textSearchUrl(query: string, origin: LatLng, key: string): string {
  return `${PLACES_BASE}/textsearch/json?query=${encodeURIComponent(query)}&location=${origin.lat},${origin.lng}&radius=${TEXT_SEARCH_RADIUS_M}&key=${key}`;
}

export function placeDetailsUrl(placeId: string, key: string): string {
  return `${PLACES_BASE}/details/json?place_id=${encodeURIComponent(placeId)}&fields=website,formatted_phone_number&key=${key}`;
}

/** Only plain web links may be opened or saved as a shop's website. */
export function isWebUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url.trim());
}
