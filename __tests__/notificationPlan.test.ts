import { buildNotificationPlan, isMaintenanceNotificationId, maintenanceNotificationId, PlannedNotification } from '@/lib/notificationPlan';
import { getInspectionStatus } from '@/lib/serviceStatus';
import { makeVehicle } from './helpers/makeVehicle';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

const now = new Date();
const civic = makeVehicle({
  id: 'civic-id',
  created_at: '2026-01-01T00:00:00Z',
  last_oil_change_date: '2020-01-01',
  last_oil_change_mileage: 10000,
  current_mileage: 50000,
});
const accord = makeVehicle({
  id: 'accord-id',
  model: 'Accord',
  created_at: '2026-02-01T00:00:00Z',
  last_inspection_date: isoDaysAgo(180),
  emissions_enabled: false,
});

function byId(plan: PlannedNotification[], id: string) {
  return plan.find(p => p.identifier === id);
}

describe('buildNotificationPlan', () => {
  const plan = buildNotificationPlan([accord, civic], now);

  it('schedules a daily 9am reminder named for the car when oil is overdue', () => {
    const oil = byId(plan, 'civic-id:oil_change_reminder');
    expect(oil?.trigger).toEqual({ type: 'calendar', hour: 9, minute: 0, repeats: true });
    expect(oil?.content.title).toBe('Oil Change Due: 2015 Honda Civic');
    expect(oil?.content.body).toBe('Your oil change is due — tap to schedule or log.');
  });

  it('schedules a date reminder on the inspection due date when not overdue', () => {
    const insp = byId(plan, 'accord-id:inspection_reminder');
    expect(insp?.trigger).toEqual({ type: 'date', date: getInspectionStatus(accord).dueDate });
    expect(insp?.content.title).toBe('Inspection Due: 2015 Honda Accord');
  });

  it('skips emissions for a vehicle with emissions disabled', () => {
    expect(plan.some(p => p.identifier.endsWith('emissions_reminder'))).toBe(false);
  });

  it('tags maintenance reminders with the vehicle id', () => {
    expect(byId(plan, 'civic-id:oil_change_reminder')?.content.data).toEqual({ type: 'maintenance_reminder', vehicleId: 'civic-id' });
  });

  it('sends the daily reminder when there is no oil record (treated as overdue)', () => {
    expect(byId(plan, 'accord-id:oil_change_reminder')?.trigger).toEqual({ type: 'calendar', hour: 9, minute: 0, repeats: true });
  });

  it('falls back to now + interval months when oil has mileage but no date', () => {
    const mileageOnly = makeVehicle({ id: 'm-id', last_oil_change_mileage: 49000, current_mileage: 50000 });
    const oil = byId(buildNotificationPlan([mileageOnly], now), 'm-id:oil_change_reminder');
    const expected = new Date(now.getFullYear(), now.getMonth() + 4, now.getDate());
    expect(oil?.trigger).toEqual({ type: 'date', date: expected });
  });

  it('includes exactly one monthly mileage prompt', () => {
    const mileage = plan.filter(p => p.identifier === 'mileage_update');
    expect(mileage).toHaveLength(1);
    expect(mileage[0].trigger).toEqual({ type: 'calendar', day: 1, hour: 9, minute: 0, repeats: true });
    expect(mileage[0].content.data).toEqual({ type: 'mileage_update' });
  });

  it('is empty with no vehicles', () => {
    expect(buildNotificationPlan([], now)).toEqual([]);
  });

  it('names duplicates distinctly', () => {
    const twin = makeVehicle({ id: 'twin-id', created_at: '2026-03-01T00:00:00Z', last_oil_change_date: '2020-01-01', last_oil_change_mileage: 10000 });
    const p = buildNotificationPlan([civic, twin], now);
    expect(byId(p, 'twin-id:oil_change_reminder')?.content.title).toBe('Oil Change Due: 2015 Honda Civic #2');
  });
});

describe('notification ids', () => {
  it('builds per-vehicle ids', () => {
    expect(maintenanceNotificationId('abc', 'emissions_inspection')).toBe('abc:emissions_reminder');
  });
  it('recognises legacy single-vehicle ids', () => {
    expect(isMaintenanceNotificationId('oil_change_reminder')).toBe(true);
    expect(isMaintenanceNotificationId('inspection_reminder')).toBe(true);
    expect(isMaintenanceNotificationId('emissions_reminder')).toBe(true);
  });
  it('recognises per-vehicle ids', () => {
    expect(isMaintenanceNotificationId('abc:inspection_reminder')).toBe(true);
  });
  it('rejects other ids', () => {
    expect(isMaintenanceNotificationId('mileage_update')).toBe(false);
    expect(isMaintenanceNotificationId('random')).toBe(false);
  });
});
