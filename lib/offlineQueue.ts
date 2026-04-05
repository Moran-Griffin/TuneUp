import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { ServiceType } from '@/types';

const QUEUE_KEY = 'offline_log_queue';

export interface QueuedLog {
  id: string; // client-side UUID for deduplication
  vehicle_id: string;
  user_id: string;
  type: ServiceType;
  date: string;
  mileage?: number;
  shop_name?: string;
  cost?: number;
  notes?: string;
  queued_at: string;
}

export async function enqueueLog(entry: Omit<QueuedLog, 'id' | 'queued_at'>): Promise<void> {
  const existing = await getQueue();
  const item: QueuedLog = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    queued_at: new Date().toISOString(),
  };
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...existing, item]));
}

export async function getQueue(): Promise<QueuedLog[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedLog[];
  } catch {
    return [];
  }
}

export async function replayQueue(): Promise<{ replayed: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { replayed: 0, failed: 0 };

  const remaining: QueuedLog[] = [];
  let replayed = 0;
  let failed = 0;

  for (const item of queue) {
    const { id, queued_at, ...entry } = item;
    const { error } = await supabase.from('maintenance_logs').insert(entry);
    if (error) {
      remaining.push(item);
      failed++;
    } else {
      replayed++;
    }
  }

  if (remaining.length === 0) {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } else {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  }

  return { replayed, failed };
}

export async function getQueueCount(): Promise<number> {
  return (await getQueue()).length;
}
