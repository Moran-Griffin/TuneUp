import {
  haversineMiles,
  formatMiles,
  sortByDistance,
  filterShops,
  nearbySearchRequest,
  textSearchRequest,
  placeDetailsRequest,
  parsePlaces,
  parsePlaceNames,
  placesErrorMessage,
  SHOP_FIELD_MASK,
  SHOP_CHIPS,
  isWebUrl,
} from '@/lib/shopSearch';
import { Shop } from '@/types';

function shop(id: string, lat: number, lng: number, extra: Partial<Shop> = {}): Shop {
  return { place_id: id, name: `Shop ${id}`, vicinity: `${id} Main St`, geometry: { location: { lat, lng } }, ...extra };
}

const ORIGIN = { lat: 40.0, lng: -75.0 };

describe('haversineMiles', () => {
  it('is 0 for the same point', () => {
    expect(haversineMiles(ORIGIN, ORIGIN)).toBe(0);
  });

  it('is ~69.1 miles per degree of latitude', () => {
    expect(haversineMiles(ORIGIN, { lat: 41.0, lng: -75.0 })).toBeCloseTo(69.1, 0);
  });

  it('matches a known city pair (NYC → Philadelphia ≈ 80 mi)', () => {
    const nyc = { lat: 40.7128, lng: -74.006 };
    const phl = { lat: 39.9526, lng: -75.1652 };
    expect(haversineMiles(nyc, phl)).toBeGreaterThan(78);
    expect(haversineMiles(nyc, phl)).toBeLessThan(82);
  });
});

describe('formatMiles', () => {
  it('shows one decimal under 10 miles', () => {
    expect(formatMiles(2.345)).toBe('2.3 mi');
  });
  it('rounds to whole miles at 10+', () => {
    expect(formatMiles(12.6)).toBe('13 mi');
  });
  it('floors tiny distances at 0.1', () => {
    expect(formatMiles(0.01)).toBe('0.1 mi');
  });
});

describe('sortByDistance', () => {
  it('attaches distance and sorts nearest first', () => {
    const far = shop('far', 40.5, -75);
    const near = shop('near', 40.01, -75);
    const out = sortByDistance([far, near], ORIGIN);
    expect(out.map(s => s.place_id)).toEqual(['near', 'far']);
    expect(out[0].distanceMiles).toBeCloseTo(0.69, 1);
  });

  it('does not mutate the input', () => {
    const input = [shop('far', 40.5, -75), shop('near', 40.01, -75)];
    sortByDistance(input, ORIGIN);
    expect(input[0].place_id).toBe('far');
  });
});

describe('filterShops', () => {
  const shops = [
    shop('1', 40, -75, { name: 'Jiffy Lube', vicinity: '12 Oak Ave' }),
    shop('2', 40, -75, { name: 'Pep Boys', vicinity: '5 Lube Rd' }),
    shop('3', 40, -75, { name: 'Honda of Town', vicinity: '9 Elm St' }),
  ];

  it('returns everything for a blank query', () => {
    expect(filterShops(shops, '   ')).toHaveLength(3);
  });

  it('matches name or address, case-insensitive, trimmed', () => {
    expect(filterShops(shops, ' LUBE ').map(s => s.place_id)).toEqual(['1', '2']);
  });

  it('returns empty when nothing matches', () => {
    expect(filterShops(shops, 'tesla')).toEqual([]);
  });
});

function body(req: { init: RequestInit }) {
  return JSON.parse(req.init.body as string);
}
function headers(req: { init: RequestInit }) {
  return req.init.headers as Record<string, string>;
}

describe('SHOP_FIELD_MASK', () => {
  it('asks only for Pro-tier fields (no rating, website, phone)', () => {
    expect(SHOP_FIELD_MASK.split(',').sort()).toEqual(
      ['places.displayName', 'places.formattedAddress', 'places.id', 'places.location', 'places.shortFormattedAddress'].sort()
    );
  });
});

describe('nearbySearchRequest', () => {
  it('is one POST to Places API (New) for both shop types, nearest first', () => {
    const req = nearbySearchRequest(ORIGIN, 'KEY');
    expect(req.url).toBe('https://places.googleapis.com/v1/places:searchNearby');
    expect(req.init.method).toBe('POST');
    expect(headers(req)['X-Goog-Api-Key']).toBe('KEY');
    expect(headers(req)['X-Goog-FieldMask']).toBe(SHOP_FIELD_MASK);
    expect(headers(req)['Content-Type']).toBe('application/json');
    const b = body(req);
    expect(b.includedTypes).toEqual(['car_repair', 'car_dealer']);
    expect(b.rankPreference).toBe('DISTANCE');
    expect(b.maxResultCount).toBe(20);
    expect(b.locationRestriction.circle.center).toEqual({ latitude: 40, longitude: -75 });
    expect(b.locationRestriction.circle.radius).toBeLessThanOrEqual(50000);
  });

  it('supports a tight single-result lookup with a custom mask', () => {
    const req = nearbySearchRequest(ORIGIN, 'KEY', { radiusM: 100, maxResults: 1, fieldMask: 'places.displayName' });
    expect(headers(req)['X-Goog-FieldMask']).toBe('places.displayName');
    expect(body(req).maxResultCount).toBe(1);
    expect(body(req).locationRestriction.circle.radius).toBe(100);
  });
});

describe('textSearchRequest', () => {
  it('posts the raw query biased to the user location', () => {
    const req = textSearchRequest('tire & brake', ORIGIN, 'KEY');
    expect(req.url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(req.init.method).toBe('POST');
    expect(headers(req)['X-Goog-FieldMask']).toBe(SHOP_FIELD_MASK);
    const b = body(req);
    expect(b.textQuery).toBe('tire & brake');
    expect(b.pageSize).toBe(20);
    expect(b.locationBias.circle.center).toEqual({ latitude: 40, longitude: -75 });
  });
});

describe('placeDetailsRequest', () => {
  it('GETs only website and phone for one place', () => {
    const req = placeDetailsRequest('ChIJ/abc', 'KEY');
    expect(req.url).toBe('https://places.googleapis.com/v1/places/ChIJ%2Fabc');
    expect(req.init.method).toBe('GET');
    expect(headers(req)['X-Goog-FieldMask']).toBe('websiteUri,nationalPhoneNumber');
  });
});

describe('parsePlaces', () => {
  it('maps New API places onto the Shop shape', () => {
    const shops = parsePlaces({
      places: [
        { id: 'p1', displayName: { text: 'Jiffy Lube' }, shortFormattedAddress: '12 Oak Ave', formattedAddress: '12 Oak Ave, Town, ST', location: { latitude: 40.1, longitude: -75.2 } },
        { id: 'p2', displayName: { text: 'Pep Boys' }, formattedAddress: '5 Lube Rd, Town', location: { latitude: 40.2, longitude: -75.3 } },
      ],
    });
    expect(shops).toEqual([
      { place_id: 'p1', name: 'Jiffy Lube', vicinity: '12 Oak Ave', geometry: { location: { lat: 40.1, lng: -75.2 } } },
      { place_id: 'p2', name: 'Pep Boys', vicinity: '5 Lube Rd, Town', geometry: { location: { lat: 40.2, lng: -75.3 } } },
    ]);
  });

  it('treats an empty response as no results', () => {
    expect(parsePlaces({})).toEqual([]);
  });

  it('drops places missing an id, name or location', () => {
    expect(parsePlaces({ places: [{ id: 'x', displayName: { text: 'No loc' } }, { displayName: { text: 'No id' }, location: { latitude: 1, longitude: 1 } }] })).toEqual([]);
  });
});

describe('placesErrorMessage', () => {
  it('explains how to fix a key without Places API (New) enabled', () => {
    const msg = placesErrorMessage({ error: { code: 403, status: 'PERMISSION_DENIED', message: 'Places API (New) has not been used in project 123 before or it is disabled.' } });
    expect(msg).toMatch(/Places API \(New\)/);
    expect(msg).toMatch(/Google Cloud/);
  });

  it('explains a hit daily quota', () => {
    expect(placesErrorMessage({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } })).toMatch(/daily limit/i);
  });

  it('falls back to status and message', () => {
    expect(placesErrorMessage({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Bad field' } })).toBe('INVALID_ARGUMENT: Bad field');
    expect(placesErrorMessage(null)).toBe('Shop search failed. Check your connection and try again.');
  });
});

describe('SHOP_CHIPS', () => {
  it('offers the four quick searches in order', () => {
    expect(SHOP_CHIPS.map(c => c.label)).toEqual(['Oil change', 'Tires', 'Inspection', 'Dealer']);
    for (const c of SHOP_CHIPS) expect(c.query.length).toBeGreaterThan(0);
  });
});

describe('isWebUrl', () => {
  it('accepts http and https links', () => {
    expect(isWebUrl('https://jiffylube.com/locations/123')).toBe(true);
    expect(isWebUrl('HTTP://example.com')).toBe(true);
  });

  it('rejects other schemes and junk', () => {
    for (const u of ['tel:5551234', 'sms:555', 'javascript:alert(1)', 'someapp://open', 'example.com', '', undefined, null]) {
      expect(isWebUrl(u as any)).toBe(false);
    }
  });
});

describe('parsePlaceNames', () => {
  it('reads names from a name-only (places.displayName) response', () => {
    expect(parsePlaceNames({ places: [{ displayName: { text: 'Jiffy Lube' } }, { displayName: {} }] })).toEqual(['Jiffy Lube']);
    expect(parsePlaceNames({})).toEqual([]);
  });
});
