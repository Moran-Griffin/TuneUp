import { logTypeLabel, normalizeCustomLabel, recentCustomLabels } from '@/lib/serviceLabel';

describe('logTypeLabel', () => {
  it('shows the custom label for Other', () => {
    expect(logTypeLabel({ type: 'other', custom_label: 'Wiper blades' })).toBe('Wiper blades');
  });
  it('trims the custom label', () => {
    expect(logTypeLabel({ type: 'other', custom_label: '  Wipers  ' })).toBe('Wipers');
  });
  it('falls back to Other for a whitespace label', () => {
    expect(logTypeLabel({ type: 'other', custom_label: '  ' })).toBe('Other');
  });
  it('falls back to Other for a null label', () => {
    expect(logTypeLabel({ type: 'other', custom_label: null })).toBe('Other');
  });
  it('ignores a label on non-Other types', () => {
    expect(logTypeLabel({ type: 'oil_change', custom_label: 'ignored' })).toBe('Oil Change');
  });
});

describe('normalizeCustomLabel', () => {
  it('trims labels for Other', () => {
    expect(normalizeCustomLabel('other', '  Wipers ')).toBe('Wipers');
  });
  it('stores null for a blank label', () => {
    expect(normalizeCustomLabel('other', ' ')).toBeNull();
  });
  it('stores null when the type is not Other', () => {
    expect(normalizeCustomLabel('battery', 'Wipers')).toBeNull();
  });
});

describe('recentCustomLabels', () => {
  it('returns most recent first, deduped case-insensitively, Other only', () => {
    const logs = [
      { type: 'other' as const, custom_label: 'Wipers', date: '2026-03-01' },
      { type: 'other' as const, custom_label: 'wipers', date: '2026-05-01' },
      { type: 'other' as const, custom_label: 'Cabin filter', date: '2026-04-01' },
      { type: 'oil_change' as const, custom_label: 'Synthetic', date: '2026-06-01' },
      { type: 'other' as const, custom_label: '  ', date: '2026-07-01' },
    ];
    expect(recentCustomLabels(logs)).toEqual(['wipers', 'Cabin filter']);
  });
  it('limits to 5 by default', () => {
    const logs = Array.from({ length: 8 }, (_, i) => ({ type: 'other' as const, custom_label: `L${i}`, date: `2026-01-0${i + 1}` }));
    expect(recentCustomLabels(logs)).toHaveLength(5);
  });
});
