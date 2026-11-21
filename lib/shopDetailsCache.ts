import { isWebUrl } from '@/lib/shopSearch';

// On-device cache of each shop's website/phone, so a shop's Place Details
// (Enterprise SKU, 1,000 free/month) is paid for at most once per 30 days.

export const DETAILS_CACHE_KEY = '@tuneup/shop_details_cache';
export const DETAILS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ShopDetails = { website: string | null; phone: string | null };
export type DetailsCache = Record<string, ShopDetails & { at: number }>;

/** Only values safe to open: an http(s) website and a string phone. */
function sanitize(website: unknown, phone: unknown): ShopDetails {
  return {
    website: isWebUrl(website as string) ? (website as string).trim() : null,
    phone: typeof phone === 'string' && phone.length > 0 ? phone : null,
  };
}

/** Parse the stored cache; anything that isn't a plain object becomes an empty cache. */
export function parseDetailsCache(raw: string | null): DetailsCache {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as DetailsCache) : {};
  } catch {
    return {};
  }
}

/** Cache hit, re-validated on read so corrupt storage can't open an unsafe link. */
export function cachedDetails(cache: DetailsCache, placeId: string, now: number): ShopDetails | null {
  const hit = cache[placeId];
  if (!hit || typeof hit.at !== 'number' || now - hit.at > DETAILS_TTL_MS) return null;
  return sanitize(hit.website, hit.phone);
}

/** Add an entry, dropping expired ones so the cache doesn't grow forever. */
export function withCachedDetails(cache: DetailsCache, placeId: string, details: ShopDetails, now: number): DetailsCache {
  const fresh: DetailsCache = {};
  for (const [id, entry] of Object.entries(cache)) {
    if (typeof entry?.at === 'number' && now - entry.at <= DETAILS_TTL_MS) fresh[id] = entry;
  }
  fresh[placeId] = { ...details, at: now };
  return fresh;
}

/** Details from a Place Details (New) response; cache only a readable OK answer. */
export function detailsFromResponse(ok: boolean, data: any): { details: ShopDetails; cacheable: boolean } {
  const readable = data !== null && typeof data === 'object';
  return {
    details: sanitize(readable ? data.websiteUri : null, readable ? data.nationalPhoneNumber : null),
    cacheable: ok && readable,
  };
}
