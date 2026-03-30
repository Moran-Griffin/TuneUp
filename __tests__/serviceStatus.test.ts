import { getOilChangeStatus, getInspectionStatus } from '@/lib/serviceStatus';
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
  last_inspection_date: null,
  inspection_interval_months: 12,
  created_at: '2024-01-01T00:00:00Z',
};

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
