import { resolveSelectedVehicleId, canSwitchVehicles } from '@/lib/vehicleSelection';
import { makeVehicle } from './helpers/makeVehicle';

const a = makeVehicle({ created_at: '2026-01-01T00:00:00Z' });
const b = makeVehicle({ created_at: '2026-02-01T00:00:00Z' });

describe('resolveSelectedVehicleId', () => {
  it('keeps a stored id that still exists', () => {
    expect(resolveSelectedVehicleId([b, a], b.id)).toBe(b.id);
  });
  it('falls back to the oldest vehicle when the stored id was deleted', () => {
    expect(resolveSelectedVehicleId([b, a], 'deleted-id')).toBe(a.id);
  });
  it('falls back to the oldest vehicle when nothing is stored', () => {
    expect(resolveSelectedVehicleId([b, a], null)).toBe(a.id);
  });
  it('returns null with no vehicles', () => {
    expect(resolveSelectedVehicleId([], 'x')).toBeNull();
  });
});

describe('canSwitchVehicles', () => {
  it('is false for one vehicle', () => {
    expect(canSwitchVehicles([a])).toBe(false);
  });
  it('is true for two vehicles', () => {
    expect(canSwitchVehicles([a, b])).toBe(true);
  });
});
