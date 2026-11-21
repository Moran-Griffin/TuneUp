import { Shop } from '@/types';

// Pure helpers for Find a Shop. No React, no fetch.

export type LatLng = { lat: number; lng: number };
export type ShopWithDistance = Shop & { distanceMiles: number };

// Places API (New). Every request names its fields: billing is the highest SKU
// any requested field belongs to. These fields are all "Pro" (5,000 free/month);
// rating, websiteUri and phone would make each search "Enterprise" (1,000 free).
const PLACES_BASE = 'https://places.googleapis.com/v1';
export const SHOP_FIELD_MASK = 'places.id,places.displayName,places.shortFormattedAddress,places.formattedAddress,places.location';
/** Place Details fields, fetched only when a shop is tapped (Enterprise, 1,000 free/month). */
const DETAILS_FIELD_MASK = 'websiteUri,nationalPhoneNumber';

const EARTH_RADIUS_MILES = 3958.8;
/** Find a Shop search radius (meters, ~10 mi). */
const NEARBY_RADIUS_M = 16000;
/** Text Search location bias radius (meters, ~15 mi). */
const TEXT_SEARCH_RADIUS_M = 25000;
const NEARBY_TYPES = ['car_repair', 'car_dealer'];

export type PlacesRequest = { url: string; init: RequestInit };

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

function headers(key: string, fieldMask: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fieldMask };
}

function circle(origin: LatLng, radius: number) {
  return { circle: { center: { latitude: origin.lat, longitude: origin.lng }, radius } };
}

/** One Nearby Search for repair shops and dealers, nearest first. */
export function nearbySearchRequest(
  origin: LatLng,
  key: string,
  opts: { radiusM?: number; maxResults?: number; fieldMask?: string } = {}
): PlacesRequest {
  return {
    url: `${PLACES_BASE}/places:searchNearby`,
    init: {
      method: 'POST',
      headers: headers(key, opts.fieldMask ?? SHOP_FIELD_MASK),
      body: JSON.stringify({
        includedTypes: NEARBY_TYPES,
        rankPreference: 'DISTANCE',
        maxResultCount: opts.maxResults ?? 20,
        locationRestriction: circle(origin, opts.radiusM ?? NEARBY_RADIUS_M),
      }),
    },
  };
}

export function textSearchRequest(query: string, origin: LatLng, key: string): PlacesRequest {
  return {
    url: `${PLACES_BASE}/places:searchText`,
    init: {
      method: 'POST',
      headers: headers(key, SHOP_FIELD_MASK),
      body: JSON.stringify({ textQuery: query, pageSize: 20, locationBias: circle(origin, TEXT_SEARCH_RADIUS_M) }),
    },
  };
}

export function placeDetailsRequest(placeId: string, key: string): PlacesRequest {
  const { 'Content-Type': _ct, ...h } = headers(key, DETAILS_FIELD_MASK);
  return { url: `${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, init: { method: 'GET', headers: h } };
}

/** Map a Places API (New) search response onto the app's Shop shape. */
export function parsePlaces(json: any): Shop[] {
  const places: any[] = Array.isArray(json?.places) ? json.places : [];
  return places
    .filter(p => p?.id && p?.displayName?.text && typeof p?.location?.latitude === 'number' && typeof p?.location?.longitude === 'number')
    .map(p => ({
      place_id: p.id,
      name: p.displayName.text,
      vicinity: p.shortFormattedAddress ?? p.formattedAddress ?? '',
      geometry: { location: { lat: p.location.latitude, lng: p.location.longitude } },
    }));
}

/** Names from a name-only (`places.displayName`) response, e.g. the background shop check. */
export function parsePlaceNames(json: any): string[] {
  const places: any[] = Array.isArray(json?.places) ? json.places : [];
  return places.map(p => p?.displayName?.text).filter((n): n is string => typeof n === 'string' && n.length > 0);
}

/** A user-facing message for a failed Places API (New) response body. */
export function placesErrorMessage(json: any): string {
  const err = json?.error;
  if (!err) return 'Shop search failed. Check your connection and try again.';
  const message: string = err.message ?? '';
  if (err.status === 'PERMISSION_DENIED' && /Places API \(New\)|not been used|disabled|blocked/i.test(message)) {
    return 'Shop search is not set up: enable "Places API (New)" for this API key in Google Cloud Console, and allow it in the key\'s API restrictions.';
  }
  if (err.status === 'RESOURCE_EXHAUSTED' || err.code === 429) {
    return 'The daily limit for shop searches has been reached. Try again tomorrow.';
  }
  // Don't show Google's raw text (it can include the Cloud project number).
  return `Shop search failed (${err.status ?? err.code ?? 'ERROR'}). Try again later.`;
}

/** Only plain web links may be opened or saved as a shop's website. */
export function isWebUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url.trim());
}
