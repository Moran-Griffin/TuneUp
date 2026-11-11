import {
  haversineMiles,
  formatMiles,
  mergeShops,
  sortByDistance,
  filterShops,
  nearbySearchUrls,
  textSearchUrl,
  SHOP_CHIPS,
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

describe('mergeShops', () => {
  it('dedupes by place_id keeping the first occurrence', () => {
    const a = shop('a', 40, -75);
    const merged = mergeShops([[a, shop('b', 40, -75)], [shop('a', 1, 1, { name: 'dupe' }), shop('c', 40, -75)]]);
    expect(merged.map(s => s.place_id)).toEqual(['a', 'b', 'c']);
    expect(merged[0]).toBe(a);
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

describe('nearbySearchUrls', () => {
  it('makes one request per type (legacy API ignores multi-type lists), ranked by distance', () => {
    const urls = nearbySearchUrls(ORIGIN, 'KEY');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('type=car_repair');
    expect(urls[1]).toContain('type=car_dealer');
    for (const u of urls) {
      expect(u).toContain('location=40,-75');
      expect(u).toContain('rankby=distance');
      expect(u).not.toContain('|');
      expect(u).not.toContain('radius=');
      expect(u).toContain('key=KEY');
    }
  });
});

describe('textSearchUrl', () => {
  it('encodes the query and biases to the user location', () => {
    const u = textSearchUrl('tire & brake', ORIGIN, 'KEY');
    expect(u).toContain('/textsearch/json?');
    expect(u).toContain('query=tire%20%26%20brake');
    expect(u).toContain('location=40,-75');
    expect(u).toContain('radius=');
    expect(u).toContain('key=KEY');
  });
});

describe('SHOP_CHIPS', () => {
  it('offers the four quick searches in order', () => {
    expect(SHOP_CHIPS.map(c => c.label)).toEqual(['Oil change', 'Tires', 'Inspection', 'Dealer']);
    for (const c of SHOP_CHIPS) expect(c.query.length).toBeGreaterThan(0);
  });
});
