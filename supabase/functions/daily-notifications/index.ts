import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const OIL_CHANGE_INTERVAL_MONTHS = 6;

interface Vehicle {
  id: string;
  user_id: string;
  current_mileage: number;
  last_oil_change_date: string | null;
  last_oil_change_mileage: number | null;
  oil_change_interval_miles: number;
  last_inspection_date: string | null;
  inspection_interval_months: number;
  user_profiles: { push_token: string | null };
}

function getOilDue(v: Vehicle): { isDue: boolean; isOverdue: boolean; milesUntilDue: number | null } {
  let mileageOverdue = false, mileageDueSoon = false, dateOverdue = false;
  let milesUntilDue: number | null = null;

  if (v.last_oil_change_mileage !== null) {
    milesUntilDue = (v.last_oil_change_mileage + v.oil_change_interval_miles) - v.current_mileage;
    mileageOverdue = milesUntilDue < 0;
    mileageDueSoon = milesUntilDue <= 500;
  }

  if (v.last_oil_change_date) {
    const due = new Date(v.last_oil_change_date);
    due.setMonth(due.getMonth() + OIL_CHANGE_INTERVAL_MONTHS);
    dateOverdue = new Date() > due;
  }

  return {
    isDue: mileageDueSoon || mileageOverdue || dateOverdue || (!v.last_oil_change_date && !v.last_oil_change_mileage),
    isOverdue: mileageOverdue || dateOverdue,
    milesUntilDue,
  };
}

function getInspectionDue(v: Vehicle): { isDue: boolean; isOverdue: boolean; daysUntilDue: number | null } {
  if (!v.last_inspection_date) return { isDue: true, isOverdue: true, daysUntilDue: null };
  const due = new Date(v.last_inspection_date);
  due.setMonth(due.getMonth() + v.inspection_interval_months);
  const days = Math.floor((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return { isDue: days <= 30, isOverdue: days < 0, daysUntilDue: days };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async () => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const isFirstOfMonth = today.getDate() === 1;

  const { data: vehicles, error: vehiclesError } = await supabase
    .from('vehicles')
    .select('*, user_profiles(push_token)')
    .returns<Vehicle[]>();

  if (vehiclesError) throw new Error(`Failed to fetch vehicles: ${vehiclesError.message}`);
  if (!vehicles?.length) return new Response(JSON.stringify({ sent: 0 }));

  const messages: object[] = [];

  for (const vehicle of vehicles) {
    const token = vehicle.user_profiles?.push_token;
    if (!token) continue;

    if (isFirstOfMonth) {
      messages.push({
        to: token,
        title: 'Update your mileage',
        body: "Time to update your mileage — keeping it current helps track when your next oil change is due.",
        data: { type: 'mileage_update' },
      });
      continue;
    }

    const oil = getOilDue(vehicle);
    if (oil.isDue) {
      const { data: oilAppt, error: oilApptError } = await supabase
        .from('appointments')
        .select('id')
        .eq('vehicle_id', vehicle.id)
        .eq('service_type', 'oil_change')
        .eq('status', 'scheduled')
        .gte('scheduled_date', todayStr)
        .maybeSingle();

      if (oilApptError) {
        console.warn(`Appointment query failed for vehicle ${vehicle.id}:`, oilApptError.message);
      } else if (!oilAppt) {
        messages.push({
          to: token,
          title: oil.isOverdue ? '⚠️ Oil change overdue' : 'Oil change due soon',
          body: oil.milesUntilDue !== null && !oil.isOverdue
            ? `Your oil change is due in ${oil.milesUntilDue.toLocaleString('en-US')} miles.`
            : oil.isOverdue
            ? 'Your oil change is overdue. Schedule or log it in TuneUp.'
            : 'Your oil change is due soon.',
          data: { type: 'maintenance_reminder', service_type: 'oil_change' },
        });
      }
    }

    const insp = getInspectionDue(vehicle);
    if (insp.isDue) {
      const { data: inspAppt, error: inspApptError } = await supabase
        .from('appointments')
        .select('id')
        .eq('vehicle_id', vehicle.id)
        .eq('service_type', 'inspection')
        .eq('status', 'scheduled')
        .gte('scheduled_date', todayStr)
        .maybeSingle();

      if (inspApptError) {
        console.warn(`Appointment query failed for vehicle ${vehicle.id}:`, inspApptError.message);
      } else if (!inspAppt) {
        messages.push({
          to: token,
          title: insp.isOverdue ? '⚠️ Inspection overdue' : 'Inspection due soon',
          body: insp.daysUntilDue !== null && !insp.isOverdue
            ? `Your vehicle inspection is due in ${insp.daysUntilDue} days.`
            : insp.isOverdue
            ? 'Your vehicle inspection is overdue. Schedule or log it in TuneUp.'
            : 'Your vehicle inspection is due soon.',
          data: { type: 'maintenance_reminder', service_type: 'inspection' },
        });
      }
    }
  }

  // Send in batches of 100
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    if (!res.ok) {
      console.warn(`Expo push batch failed: HTTP ${res.status}`);
    }
  }

  return new Response(JSON.stringify({ sent: messages.length }));
});
