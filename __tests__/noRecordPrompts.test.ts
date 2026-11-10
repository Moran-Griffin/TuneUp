import { takeNoRecordPrompts } from '@/lib/noRecordPrompts';
import { makeVehicle } from './helpers/makeVehicle';

describe('takeNoRecordPrompts', () => {
  const a = makeVehicle({ id: 'a' });
  const b = makeVehicle({ id: 'b', emissions_enabled: true });

  it('prompts each missing service once per vehicle, even after switching back', () => {
    const prompted = new Set<string>();
    expect(takeNoRecordPrompts(a, prompted)).toEqual(['oil', 'inspection']);
    expect(takeNoRecordPrompts(b, prompted)).toEqual(['oil', 'inspection', 'emissions']);
    expect(takeNoRecordPrompts(a, prompted)).toEqual([]);
    expect(takeNoRecordPrompts(b, prompted)).toEqual([]);
  });

  it('skips services that have a record or an override', () => {
    const v = makeVehicle({ id: 'c', last_oil_change_mileage: 40000, inspection_due_date_override: '2027-01-01' });
    expect(takeNoRecordPrompts(v, new Set())).toEqual([]);
  });

  it('skips emissions when tracking is off', () => {
    expect(takeNoRecordPrompts(makeVehicle({ id: 'd', last_oil_change_date: '2026-01-01', last_inspection_date: '2026-01-01' }), new Set())).toEqual([]);
  });
});
