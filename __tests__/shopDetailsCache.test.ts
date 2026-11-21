import { cachedDetails, withCachedDetails, DETAILS_TTL_MS } from '@/lib/shopDetailsCache';

const NOW = 1_800_000_000_000;

describe('shop details cache', () => {
  it('misses when the place was never looked up', () => {
    expect(cachedDetails({}, 'p1', NOW)).toBeNull();
  });

  it('returns a fresh entry, including a cached "no website"', () => {
    let cache = withCachedDetails({}, 'p1', { website: 'https://a.com', phone: null }, NOW);
    cache = withCachedDetails(cache, 'p2', { website: null, phone: '(555) 123-4567' }, NOW);
    expect(cachedDetails(cache, 'p1', NOW + 1000)).toEqual({ website: 'https://a.com', phone: null });
    expect(cachedDetails(cache, 'p2', NOW + 1000)).toEqual({ website: null, phone: '(555) 123-4567' });
  });

  it('expires entries after the TTL (30 days)', () => {
    expect(DETAILS_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    const cache = withCachedDetails({}, 'p1', { website: 'https://a.com', phone: null }, NOW);
    expect(cachedDetails(cache, 'p1', NOW + DETAILS_TTL_MS + 1)).toBeNull();
  });

  it('does not mutate the previous cache', () => {
    const before = {};
    withCachedDetails(before, 'p1', { website: null, phone: null }, NOW);
    expect(before).toEqual({});
  });
});
