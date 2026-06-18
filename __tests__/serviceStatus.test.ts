import { getOilChangeStatus, getInspectionStatus, getEmissionsStatus } from '@/lib/serviceStatus';
import { Vehicle } from '@/types';

const baseVehicle: Vehicle = {
  id: '1',
  user_id: 'u1',
  make: 'Toyota',
  model: 'Camry',
  year: '2020',
  current_mileage: 50000,
  last_oil_change_date: null,
  last_oil_change_mileage: null,
  oil_change_interval_miles: 5000,
  oil_change_interval_months: 6,
  last_inspection_date: null,
  inspection_interval_months: 12,
  emissions_enabled: false,
  last_emissions_date: null,
  emissions_interval_months: 24,
  oil_due_mileage_override: null,
  oil_due_date_override: null,
  inspection_due_date_override: null,
  emissions_due_date_override: null,
  created_at: '2024-01-01T00:00:00Z',
};

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0];
}

describe('getOilChangeStatus', () => {
  it('is overdue when within 500 miles of interval', () => {
    const v: Vehicle = {
      ...baseVehicle,
      current_mileage: 50400,
      last_oil_change_mileage: 45000,
      last_oil_change_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
    const status = getOilChangeStatus(v);
    expect(status.isDue).toBe(true);
    expect(status.milesUntilDue).toBe(-400);
    expect(status.isOverdue).toBe(true);
  });

  it('is due when within 500 miles of interval', () => {
    const v: Vehicle = {
      ...baseVehicle,
      current_mileage: 49600,
      last_oil_change_mileage: 45000,
      last_oil_change_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
    const status = getOilChangeStatus(v);
    expect(status.isDue).toBe(true);
    expect(status.milesUntilDue).toBe(400);
    expect(status.isOverdue).toBe(false);
  });

  it('is not due when far from interval', () => {
    const v: Vehicle = {
      ...baseVehicle,
      current_mileage: 46000,
      last_oil_change_mileage: 45000,
      last_oil_change_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
    const status = getOilChangeStatus(v);
    expect(status.isDue).toBe(false);
  });

  it('is due when 6+ months since last change regardless of mileage', () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 7);
    const v: Vehicle = {
      ...baseVehicle,
      current_mileage: 46000,
      last_oil_change_mileage: 45000,
      last_oil_change_date: sixMonthsAgo.toISOString().split('T')[0],
    };
    const status = getOilChangeStatus(v);
    expect(status.isDue).toBe(true);
    expect(status.isOverdue).toBe(true);
  });

  it('is overdue when no oil change data exists', () => {
    const status = getOilChangeStatus(baseVehicle);
    expect(status.isDue).toBe(true);
    expect(status.isOverdue).toBe(true);
  });
});

describe('getInspectionStatus', () => {
  it('is due 30 days before anniversary', () => {
    const tenMonthsAgo = new Date();
    tenMonthsAgo.setMonth(tenMonthsAgo.getMonth() - 11);
    const v: Vehicle = {
      ...baseVehicle,
      last_inspection_date: tenMonthsAgo.toISOString().split('T')[0],
    };
    const status = getInspectionStatus(v);
    expect(status.isDue).toBe(true);
    expect(status.isOverdue).toBe(false);
  });

  it('is overdue when past anniversary', () => {
    const thirteenMonthsAgo = new Date();
    thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);
    const v: Vehicle = {
      ...baseVehicle,
      last_inspection_date: thirteenMonthsAgo.toISOString().split('T')[0],
    };
    const status = getInspectionStatus(v);
    expect(status.isDue).toBe(true);
    expect(status.isOverdue).toBe(true);
  });

  it('is not due when inspection is recent', () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const v: Vehicle = {
      ...baseVehicle,
      last_inspection_date: twoMonthsAgo.toISOString().split('T')[0],
    };
    const status = getInspectionStatus(v);
    expect(status.isDue).toBe(false);
  });

  it('is overdue when no inspection date exists', () => {
    const status = getInspectionStatus(baseVehicle);
    expect(status.isDue).toBe(true);
    expect(status.isOverdue).toBe(true);
  });
});

describe('getOilChangeStatus overrides', () => {
  it('uses oil_due_mileage_override instead of the computed due mileage', () => {
    const v: Vehicle = {
      ...baseVehicle,
      current_mileage: 40500,
      last_oil_change_mileage: 36449,
      last_oil_change_date: monthsAgo(1),
      oil_due_mileage_override: 50000,
    };
    const status = getOilChangeStatus(v);
    expect(status.dueMileage).toBe(50000);
    expect(status.milesUntilDue).toBe(9500);
    expect(status.isOverdue).toBe(false);
  });

  it('is overdue when current mileage is past the mileage override', () => {
    const v: Vehicle = {
      ...baseVehicle,
      current_mileage: 41000,
      last_oil_change_mileage: 36449,
      last_oil_change_date: monthsAgo(1),
      oil_due_mileage_override: 40000,
    };
    const status = getOilChangeStatus(v);
    expect(status.milesUntilDue).toBe(-1000);
    expect(status.isOverdue).toBe(true);
  });

  it('uses oil_due_date_override for the date track, ignoring a stale last-change date', () => {
    const v: Vehicle = {
      ...baseVehicle,
      current_mileage: 46000,
      last_oil_change_mileage: 45000,
      last_oil_change_date: monthsAgo(8),
      oil_due_date_override: daysFromNow(60),
    };
    const status = getOilChangeStatus(v);
    expect(status.isOverdue).toBe(false);
  });

  it('is not treated as noRecord when only an override is set', () => {
    const v: Vehicle = { ...baseVehicle, oil_due_mileage_override: 60000 };
    const status = getOilChangeStatus(v);
    expect(status.noRecord).toBe(false);
    expect(status.dueMileage).toBe(60000);
  });
});

describe('getInspectionStatus override', () => {
  it('uses inspection_due_date_override', () => {
    const v: Vehicle = {
      ...baseVehicle,
      last_inspection_date: null,
      inspection_due_date_override: daysFromNow(10),
    };
    const status = getInspectionStatus(v);
    expect(status.isOverdue).toBe(false);
    expect(status.isDue).toBe(true);
    expect(status.noRecord).toBe(false);
  });

  it('is overdue when the override date is in the past', () => {
    const v: Vehicle = { ...baseVehicle, inspection_due_date_override: daysFromNow(-5) };
    const status = getInspectionStatus(v);
    expect(status.isOverdue).toBe(true);
  });
});

describe('getEmissionsStatus override', () => {
  it('uses emissions_due_date_override', () => {
    const v: Vehicle = {
      ...baseVehicle,
      last_emissions_date: null,
      emissions_due_date_override: daysFromNow(-3),
    };
    const status = getEmissionsStatus(v);
    expect(status.isOverdue).toBe(true);
    expect(status.noRecord).toBe(false);
  });
});
