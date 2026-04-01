import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Appointment, ServiceType } from '@/types';

export function useAppointments(vehicleId: string | undefined) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    if (!vehicleId) { setLoading(false); return; }
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('status', 'scheduled')
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true });
    setAppointments(data ?? []);
    setLoading(false);
  }, [vehicleId]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  async function addAppointment(data: {
    shop_name: string;
    shop_url?: string;
    service_type: ServiceType;
    scheduled_date: string;
    scheduled_time?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from('appointments')
      .insert({ ...data, vehicle_id: vehicleId, user_id: user!.id })
      .select()
      .single();
    if (error) throw error;
    setAppointments(prev => [...prev, created]);
    return created;
  }

  async function updateAppointment(id: string, status: 'completed' | 'cancelled', mileage?: number) {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) throw error;

    if (status === 'completed') {
      const appointment = appointments.find(a => a.id === id);
      if (appointment) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('maintenance_logs').insert({
          vehicle_id: appointment.vehicle_id,
          user_id: user!.id,
          type: appointment.service_type,
          date: appointment.scheduled_date,
          shop_name: appointment.shop_name,
          mileage: mileage ?? null,
        });
      }
    }

    setAppointments(prev => prev.filter(a => a.id !== id));
  }

  return { appointments, loading, addAppointment, updateAppointment, refetch: fetchAppointments };
}
