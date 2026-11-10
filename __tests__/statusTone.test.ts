import { statusTone } from '@/lib/serviceCardLabels';
import { ServiceStatus } from '@/types';

const base: ServiceStatus = { isDue: false, isOverdue: false, noRecord: false, dueDate: null, dueMileage: null, milesUntilDue: null, daysUntilDue: null };

describe('statusTone', () => {
  it('is red when overdue', () => {
    expect(statusTone({ ...base, isDue: true, isOverdue: true })).toBe('red');
  });
  it('is red when there is no record (status reports overdue)', () => {
    expect(statusTone({ ...base, isDue: true, isOverdue: true, noRecord: true })).toBe('red');
  });
  it('is yellow when due soon', () => {
    expect(statusTone({ ...base, isDue: true })).toBe('yellow');
  });
  it('is yellow when scheduled but not yet due', () => {
    expect(statusTone(base, true)).toBe('yellow');
  });
  it('is green when up to date and not scheduled', () => {
    expect(statusTone(base)).toBe('green');
  });
});
