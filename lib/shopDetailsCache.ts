// On-device cache of each shop's website/phone, so a shop's Place Details
// (Enterprise SKU, 1,000 free/month) is paid for at most once per 30 days.

export const DETAILS_CACHE_KEY = '@tuneup/shop_details_cache';
export const DETAILS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ShopDetails = { website: string | null; phone: string | null };
export type DetailsCache = Record<string, ShopDetails & { at: number }>;

export function cachedDetails(cache: DetailsCache, placeId: string, now: number): ShopDetails | null {
  const hit = cache[placeId];
  if (!hit || now - hit.at > DETAILS_TTL_MS) return null;
  return { website: hit.website, phone: hit.phone };
}

export function withCachedDetails(cache: DetailsCache, placeId: string, details: ShopDetails, now: number): DetailsCache {
  return { ...cache, [placeId]: { ...details, at: now } };
}
