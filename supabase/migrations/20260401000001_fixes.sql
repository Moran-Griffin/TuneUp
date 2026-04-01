-- Fix 1: Same-date oil change logs — higher mileage should win
-- Previously the second insert always overwrote mileage. Now when dates are equal,
-- only update mileage if the new value is greater.
create or replace function public.sync_vehicle_on_log()
returns trigger language plpgsql security definer as $$
begin
  if new.type = 'oil_change' then
    update public.vehicles set
      last_oil_change_date = case
        when last_oil_change_date is null or new.date > last_oil_change_date then new.date
        else last_oil_change_date
      end,
      last_oil_change_mileage = case
        when new.mileage is not null and (
          last_oil_change_date is null
          or new.date > last_oil_change_date
          or (new.date = last_oil_change_date and (last_oil_change_mileage is null or new.mileage > last_oil_change_mileage))
        ) then new.mileage
        else last_oil_change_mileage
      end,
      current_mileage = case
        when new.mileage is not null and new.mileage > current_mileage then new.mileage
        else current_mileage
      end
    where id = new.vehicle_id;
  elsif new.type = 'inspection' then
    update public.vehicles set
      last_inspection_date = case
        when last_inspection_date is null or new.date >= last_inspection_date then new.date
        else last_inspection_date
      end
    where id = new.vehicle_id;
  elsif new.type = 'emissions_inspection' then
    update public.vehicles set
      last_emissions_date = case
        when last_emissions_date is null or new.date >= last_emissions_date then new.date
        else last_emissions_date
      end
    where id = new.vehicle_id;
  end if;
  return new;
end;
$$;

-- Fix 2: Atomic appointment completion
-- Completes an appointment and inserts the maintenance log in a single transaction.
create or replace function public.complete_appointment(
  p_appointment_id uuid,
  p_mileage integer default null
)
returns void language plpgsql security definer as $$
declare
  v_appt record;
begin
  select * into v_appt
  from public.appointments
  where id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found';
  end if;

  update public.appointments
  set status = 'completed'
  where id = p_appointment_id;

  insert into public.maintenance_logs (vehicle_id, user_id, type, date, shop_name, mileage)
  values (v_appt.vehicle_id, v_appt.user_id, v_appt.service_type, v_appt.scheduled_date, v_appt.shop_name, p_mileage);
end;
$$;
