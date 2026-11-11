/** AsyncStorage key for the user's appearance override. Absent = follow the device. */
export const THEME_KEY = 'colorScheme';

export type ThemePreference = 'light' | 'dark' | 'system';

export function parseStoredScheme(raw: string | null): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}
