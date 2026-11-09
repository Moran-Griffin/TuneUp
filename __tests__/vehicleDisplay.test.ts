import { vehicleDisplayName, sortVehicles } from '@/lib/vehicleDisplay';
import { makeVehicle } from './helpers/makeVehicle';

describe('vehicleDisplayName', () => {
  it('uses year make model without a nickname', () => {
    expect(vehicleDisplayName(makeVehicle({ year: '2015', make: 'Honda', model: 'Civic' }))).toBe('2015 Honda Civic');
  });

  it('uses nickname with year when set', () => {
    expect(vehicleDisplayName(makeVehicle({ nickname: "Dad's truck", year: '2019' }))).toBe("Dad's truck (2019)");
  });

  it('ignores a whitespace-only nickname', () => {
    expect(vehicleDisplayName(makeVehicle({ nickname: '   ', year: '2015', make: 'Honda', model: 'Civic' }))).toBe('2015 Honda Civic');
  });

  it('suffixes later duplicates by creation order', () => {
    const a = makeVehicle({ created_at: '2026-01-01T00:00:00Z' });
    const b = makeVehicle({ created_at: '2026-02-01T00:00:00Z' });
    const c = makeVehicle({ created_at: '2026-03-01T00:00:00Z' });
    expect(vehicleDisplayName(a, [c, b, a])).toBe('2015 Honda Civic');
    expect(vehicleDisplayName(b, [c, b, a])).toBe('2015 Honda Civic #2');
    expect(vehicleDisplayName(c, [c, b, a])).toBe('2015 Honda Civic #3');
  });

  it('does not suffix when names differ', () => {
    const a = makeVehicle({ created_at: '2026-01-01T00:00:00Z' });
    const b = makeVehicle({ created_at: '2026-02-01T00:00:00Z', model: 'Accord' });
    expect(vehicleDisplayName(b, [a, b])).toBe('2015 Honda Accord');
  });
});

describe('sortVehicles', () => {
  it('orders by created_at ascending without mutating input', () => {
    const a = makeVehicle({ created_at: '2026-01-01T00:00:00Z' });
    const b = makeVehicle({ created_at: '2026-02-01T00:00:00Z' });
    const input = [b, a];
    expect(sortVehicles(input)).toEqual([a, b]);
    expect(input).toEqual([b, a]);
  });
});
