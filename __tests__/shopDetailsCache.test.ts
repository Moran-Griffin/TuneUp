import { cachedDetails, withCachedDetails, parseDetailsCache, detailsFromResponse, DETAILS_TTL_MS } from '@/lib/shopDetailsCache';

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

describe('shop details cache hardening', () => {
  it('re-checks cached values on read (corrupt or edited storage)', () => {
    const cache: any = { p1: { website: 'javascript:alert(1)', phone: 42, at: NOW } };
    expect(cachedDetails(cache, 'p1', NOW)).toEqual({ website: null, phone: null });
  });

  it('drops expired entries when writing', () => {
    let cache = withCachedDetails({}, 'old', { website: null, phone: null }, NOW);
    cache = withCachedDetails(cache, 'new', { website: null, phone: null }, NOW + DETAILS_TTL_MS + 1);
    expect(Object.keys(cache)).toEqual(['new']);
  });
});

describe('parseDetailsCache', () => {
  it('accepts a stored object', () => {
    expect(parseDetailsCache(JSON.stringify({ p1: { website: null, phone: null, at: NOW } }))).toEqual({ p1: { website: null, phone: null, at: NOW } });
  });

  it('returns an empty cache for missing, invalid or non-object values', () => {
    for (const raw of [null, '', 'not json', 'null', '42', '"text"', '[1,2]']) {
      expect(parseDetailsCache(raw)).toEqual({});
    }
  });
});

describe('detailsFromResponse', () => {
  it('keeps only an http(s) website and a string phone, and is cacheable when OK', () => {
    expect(detailsFromResponse(true, { websiteUri: ' https://a.com ', nationalPhoneNumber: '(555) 123-4567' }))
      .toEqual({ details: { website: 'https://a.com', phone: '(555) 123-4567' }, cacheable: true });
    expect(detailsFromResponse(true, { websiteUri: 'tel:123' }).details.website).toBeNull();
  });

  it('caches an OK response that lists no website', () => {
    expect(detailsFromResponse(true, {})).toEqual({ details: { website: null, phone: null }, cacheable: true });
  });

  it('never caches errors or unreadable bodies', () => {
    expect(detailsFromResponse(false, { websiteUri: 'https://a.com' }).cacheable).toBe(false);
    expect(detailsFromResponse(true, null).cacheable).toBe(false);
  });
});
