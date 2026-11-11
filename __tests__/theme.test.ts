import { parseStoredScheme, THEME_KEY } from '@/lib/theme';

describe('parseStoredScheme', () => {
  it('keeps an explicit light/dark choice', () => {
    expect(parseStoredScheme('dark')).toBe('dark');
    expect(parseStoredScheme('light')).toBe('light');
  });

  it('treats missing or unknown values as "follow the device"', () => {
    expect(parseStoredScheme(null)).toBe('system');
    expect(parseStoredScheme('system')).toBe('system');
    expect(parseStoredScheme('purple')).toBe('system');
  });

  it('uses the existing storage key so saved choices survive the update', () => {
    expect(THEME_KEY).toBe('colorScheme');
  });
});
