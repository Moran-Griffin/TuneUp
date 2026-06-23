import { getStatusSubtitle, getDueDetail } from '@/lib/serviceCardLabels';
import { ServiceStatus } from '@/types';

const base: ServiceStatus = {
  isDue: false,
  isOverdue: false,
  noRecord: false,
  dueDate: null,
  dueMileage: null,
  milesUntilDue: null,
  daysUntilDue: null,
};

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

describe('getStatusSubtitle', () => {
  it('regression: oil overdue by TIME shows days, not the remaining miles as "overdue"', () => {
    // last change 11/28/25 + 6mo = 5/28/26 (past); current 40,050, due 41,450 → +1,400 left
    const status: ServiceStatus = {
      ...base,
      isDue: true,
      isOverdue: true,
      dueMileage: 41450,
      milesUntilDue: 1400,
      dueDate: daysAgo(25),
    };
    const subtitle = getStatusSubtitle(status);
    expect(subtitle).not.toMatch(/miles overdue/);
    expect(subtitle).toMatch(/days overdue/);
  });

  it('oil overdue by MILEAGE shows miles overdue', () => {
    const status: ServiceStatus = {
      ...base,
      isDue: true,
      isOverdue: true,
      dueMileage: 50000,
      milesUntilDue: -400,
      dueDate: daysAgo(5),
    };
    expect(getStatusSubtitle(status)).toBe('400 miles overdue');
  });

  it('oil due soon shows miles remaining', () => {
    const status: ServiceStatus = { ...base, isDue: true, dueMileage: 50000, milesUntilDue: 300 };
    expect(getStatusSubtitle(status)).toBe('Due in 300 miles');
  });

  it('inspection overdue shows days overdue from daysUntilDue', () => {
    const status: ServiceStatus = { ...base, isDue: true, isOverdue: true, daysUntilDue: -5, dueDate: daysAgo(5) };
    expect(getStatusSubtitle(status)).toBe('5 days overdue');
  });

  it('up to date when nothing is due', () => {
    expect(getStatusSubtitle({ ...base, dueMileage: 50000, milesUntilDue: 3000 })).toBe('Up to date');
  });

  it('no record', () => {
    expect(getStatusSubtitle({ ...base, noRecord: true, isDue: true, isOverdue: true })).toBe('No record found');
  });

  it('scheduled + overdue defers to appointment messaging', () => {
    const status: ServiceStatus = { ...base, isDue: true, isOverdue: true, milesUntilDue: -100, dueMileage: 50000 };
    expect(getStatusSubtitle(status, { isScheduled: true })).toBe('Overdue — appointment scheduled');
  });
});

describe('getDueDetail', () => {
  it('regression: oil overdue by TIME shows the due date, not a mileage label', () => {
    const status: ServiceStatus = {
      ...base,
      isDue: true,
      isOverdue: true,
      dueMileage: 41450,
      milesUntilDue: 1400,
      dueDate: daysAgo(25),
    };
    const detail = getDueDetail(status);
    expect(detail).toMatch(/^Was due /);
    expect(detail).not.toMatch(/mi$/);
  });

  it('oil overdue by mileage shows "Was due at <mi>"', () => {
    const status: ServiceStatus = { ...base, isDue: true, isOverdue: true, dueMileage: 50000, milesUntilDue: -400 };
    expect(getDueDetail(status)).toBe('Was due at 50,000 mi');
  });

  it('oil not overdue shows "Next due at <mi>"', () => {
    const status: ServiceStatus = { ...base, dueMileage: 50000, milesUntilDue: 3000 };
    expect(getDueDetail(status)).toBe('Next due at 50,000 mi');
  });

  it('date-only service overdue shows "Was due <date>"', () => {
    const status: ServiceStatus = { ...base, isDue: true, isOverdue: true, daysUntilDue: -5, dueDate: daysAgo(5) };
    expect(getDueDetail(status)).toMatch(/^Was due /);
  });
});
