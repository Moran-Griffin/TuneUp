import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    const count = await SecureStore.getItemAsync(`${key}__count`);
    if (!count) return SecureStore.getItemAsync(key);
    const chunks = await Promise.all(
      Array.from({ length: parseInt(count, 10) }, (_, i) =>
        SecureStore.getItemAsync(`${key}__chunk${i}`)
      )
    );
    return chunks.some(c => c === null) ? null : chunks.join('');
  },
  setItem: async (key: string, value: string) => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'g'))!;
    await SecureStore.setItemAsync(`${key}__count`, String(chunks.length));
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}__chunk${i}`, chunk))
    );
  },
  removeItem: async (key: string) => {
    const count = await SecureStore.getItemAsync(`${key}__count`);
    if (count) {
      await Promise.all([
        SecureStore.deleteItemAsync(`${key}__count`),
        ...Array.from({ length: parseInt(count, 10) }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}__chunk${i}`)
        ),
      ]);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
