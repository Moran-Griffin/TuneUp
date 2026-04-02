import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Vehicle } from '@/types';

export function useVehicle(userId: string | undefined) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        setVehicle(data ?? null);
        setLoading(false);
      });
  }, [userId]);

  async function refetch() {
    if (!userId) return;
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .single();
    setVehicle(data ?? null);
  }

  async function createVehicle(data: Omit<Vehicle, 'id' | 'user_id' | 'created_at'>) {
    const { data: created, error } = await supabase
      .from('vehicles')
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    setVehicle(created);
    return created;
  }

  async function updateVehicle(data: Partial<Omit<Vehicle, 'id' | 'user_id' | 'created_at'>>) {
    if (!vehicle) return;
    const { data: updated, error } = await supabase
      .from('vehicles')
      .update(data)
      .eq('id', vehicle.id)
      .select()
      .single();
    if (error) throw error;
    setVehicle(updated);
    return updated;
  }

  async function deleteVehicle() {
    if (!vehicle) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', vehicle.id);
    if (error) throw error;
    setVehicle(null);
  }

  return { vehicle, loading, createVehicle, updateVehicle, deleteVehicle, refetch };
}
