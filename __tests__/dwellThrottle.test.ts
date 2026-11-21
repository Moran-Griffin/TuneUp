import { dwellDecision, DWELL_LOOKUP } from '@/lib/dwellThrottle';

const T0 = 1_800_000_000_000;
const HERE = { lat: 40, lng: -75 };
// ~0.001 deg latitude ≈ 111 m
const NEAR = { lat: 40.0005, lng: -75 }; // ~56 m
const FAR = { lat: 40.002, lng: -75 }; // ~222 m

describe('dwellDecision', () => {
  it('skips the lookup while moving faster than walking pace', () => {
    expect(dwellDecision({ now: T0, at: HERE, speed: 10, last: null })).toEqual({ kind: 'moving' });
  });

  it('looks up when slow and there is no previous check', () => {
    expect(dwellDecision({ now: T0, at: HERE, speed: 0.3, last: null })).toEqual({ kind: 'lookup' });
  });

  it('treats unknown speed (-1 or null) as not moving', () => {
    expect(dwellDecision({ now: T0, at: HERE, speed: -1, last: null }).kind).toBe('lookup');
    expect(dwellDecision({ now: T0, at: HERE, speed: null, last: null }).kind).toBe('lookup');
  });

  it('reuses the last answer within the minimum gap, even after moving', () => {
    const last = { at: T0, ...HERE, shopName: 'Jiffy Lube' };
    expect(dwellDecision({ now: T0 + 60_000, at: FAR, speed: 0, last })).toEqual({ kind: 'reuse', shopName: 'Jiffy Lube' });
  });

  it('reuses the last answer when still nearby within the reuse window', () => {
    const last = { at: T0, ...HERE, shopName: null };
    expect(dwellDecision({ now: T0 + 10 * 60_000, at: NEAR, speed: 0, last })).toEqual({ kind: 'reuse', shopName: null });
  });

  it('looks up again after moving away once the minimum gap has passed', () => {
    const last = { at: T0, ...HERE, shopName: null };
    expect(dwellDecision({ now: T0 + DWELL_LOOKUP.minGapMs, at: FAR, speed: 0, last }).kind).toBe('lookup');
  });

  it('looks up again when the reuse window expires, even in place', () => {
    const last = { at: T0, ...HERE, shopName: 'Jiffy Lube' };
    expect(dwellDecision({ now: T0 + DWELL_LOOKUP.reuseWindowMs, at: HERE, speed: 0, last }).kind).toBe('lookup');
  });

  it('uses the agreed limits', () => {
    expect(DWELL_LOOKUP).toEqual({ maxSpeedMps: 2, minGapMs: 3 * 60_000, reuseRadiusM: 75, reuseWindowMs: 15 * 60_000 });
  });
});
