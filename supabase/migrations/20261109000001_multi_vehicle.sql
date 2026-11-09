-- Multi-vehicle support, custom "Other" labels, and ownership hardening.
-- Apply manually in the Supabase SQL editor (remote migration history is not tracked).

-- 1. New columns
alter table public.vehicles
  add column if not exists nickname text;

alter table public.maintenance_logs
  add column if not exists custom_label text;

alter table public.appointments
  add column if not exists custom_label text;

-- 2. RLS: a log/appointment may only reference a vehicle the user owns
drop policy if exists "Users manage own logs" on public.maintenance_logs;
create policy "Users manage own logs" on public.maintenance_logs
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own appointments" on public.appointments;
create policy "Users manage own appointments" on public.appointments
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.user_id = auth.uid()
    )
  );

-- 3. complete_appointment: only the owner may complete; carry custom_label into the log
create or replace function public.complete_appointment(
  p_appointment_id uuid,
  p_mileage integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
begin
  select * into v_appt
  from public.appointments
  where id = p_appointment_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Appointment not found';
  end if;

  update public.appointments
  set status = 'completed'
  where id = p_appointment_id;

  insert into public.maintenance_logs (vehicle_id, user_id, type, date, shop_name, mileage, custom_label)
  values (v_appt.vehicle_id, v_appt.user_id, v_appt.service_type, v_appt.scheduled_date, v_appt.shop_name, p_mileage, v_appt.custom_label);
end;
$$;
