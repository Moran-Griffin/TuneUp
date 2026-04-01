import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { MaintenanceLog, ServiceType } from '@/types';

export function useMaintenanceLogs(vehicleId: string | undefined) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!vehicleId) { setLoading(false); return; }
    const { data } = await supabase
      .from('maintenance_logs')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('date', { ascending: false });
    setLogs(data ?? []);
    setLoading(false);
  }, [vehicleId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  async function addLog(entry: {
    type: ServiceType;
    date: string;
    mileage?: number;
    shop_name?: string;
    cost?: number;
    notes?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('maintenance_logs')
      .insert({ ...entry, vehicle_id: vehicleId, user_id: user!.id })
      .select()
      .single();
    if (error) throw error;
    setLogs(prev => [data, ...prev]);
    return data;
  }

  async function updateLog(id: string, updates: Partial<Omit<MaintenanceLog, 'id' | 'vehicle_id' | 'user_id' | 'created_at' | 'updated_at'>>) {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    setLogs(prev => prev.map(l => l.id === id ? data : l));
    return data;
  }

  async function deleteLog(id: string) {
    setLogs(prev => prev.filter(l => l.id !== id));
    const { error } = await supabase.from('maintenance_logs').delete().eq('id', id);
    if (error) {
      await fetchLogs();
      throw error;
    }
  }

  return { logs, loading, addLog, updateLog, deleteLog, refetch: fetchLogs };
}
