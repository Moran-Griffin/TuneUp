import { Vehicle } from '@/types';

let seq = 0;
export function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  seq += 1;
  return {
    id: `v${seq}`,
    user_id: 'u1',
    nickname: null,
    make: 'Honda',
    model: 'Civic',
    year: '2015',
    current_mileage: 50000,
    last_oil_change_date: null,
    last_oil_change_mileage: null,
    oil_change_interval_miles: 5000,
    oil_change_interval_months: 4,
    last_inspection_date: null,
    inspection_interval_months: 12,
    emissions_enabled: false,
    last_emissions_date: null,
    emissions_interval_months: 24,
    oil_due_mileage_override: null,
    oil_due_date_override: null,
    inspection_due_date_override: null,
    emissions_due_date_override: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
