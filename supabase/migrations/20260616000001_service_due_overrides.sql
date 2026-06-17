-- Manual due-target overrides for the Home-screen service status cards.
alter table vehicles
  add column if not exists oil_due_mileage_override integer,
  add column if not exists oil_due_date_override date,
  add column if not exists inspection_due_date_override date,
  add column if not exists emissions_due_date_override date;

-- When a real service is logged, clear the matching manual override so the
-- freshly logged service recomputes cleanly instead of staying pinned to a
-- stale manual value. (Redefines the latest sync_vehicle_on_log from
-- 20260401000001_fixes.sql, adding the override-clearing lines.)
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
      end,
      oil_due_mileage_override = null,
      oil_due_date_override = null
    where id = new.vehicle_id;
  elsif new.type = 'inspection' then
    update public.vehicles set
      last_inspection_date = case
        when last_inspection_date is null or new.date >= last_inspection_date then new.date
        else last_inspection_date
      end,
      inspection_due_date_override = null
    where id = new.vehicle_id;
  elsif new.type = 'emissions_inspection' then
    update public.vehicles set
      last_emissions_date = case
        when last_emissions_date is null or new.date >= last_emissions_date then new.date
        else last_emissions_date
      end,
      emissions_due_date_override = null
    where id = new.vehicle_id;
  end if;
  return new;
end;
$$;
