-- User profiles (push token storage, extends auth.users)
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  push_token text,
  updated_at timestamptz default now()
);
alter table public.user_profiles enable row level security;
create policy "Users manage own profile" on public.user_profiles
  for all using (auth.uid() = id);

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Vehicles
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  make text not null,
  model text not null,
  year text not null,
  current_mileage integer not null default 0,
  last_oil_change_date date,
  last_oil_change_mileage integer,
  oil_change_interval_miles integer not null default 5000,
  last_inspection_date date,
  inspection_interval_months integer not null default 12,
  created_at timestamptz default now()
);
alter table public.vehicles enable row level security;
create policy "Users manage own vehicles" on public.vehicles
  for all using (auth.uid() = user_id);

-- Maintenance logs
create table public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  date date not null,
  mileage integer,
  shop_name text,
  cost numeric(10,2),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.maintenance_logs enable row level security;
create policy "Users manage own logs" on public.maintenance_logs
  for all using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger maintenance_logs_updated_at
  before update on public.maintenance_logs
  for each row execute procedure public.set_updated_at();

-- When an oil_change or inspection log is saved, update the vehicle record
create or replace function public.sync_vehicle_on_log()
returns trigger language plpgsql security definer as $$
begin
  if new.type = 'oil_change' then
    update public.vehicles set
      last_oil_change_date = case
        when last_oil_change_date is null or new.date >= last_oil_change_date
        then new.date
        else last_oil_change_date
      end,
      last_oil_change_mileage = case
        when new.mileage is not null and (last_oil_change_date is null or new.date >= last_oil_change_date)
        then new.mileage
        else last_oil_change_mileage
      end,
      current_mileage = case
        when new.mileage is not null and new.mileage > current_mileage
        then new.mileage
        else current_mileage
      end
    where id = new.vehicle_id;
  elsif new.type = 'inspection' then
    update public.vehicles set
      last_inspection_date = case
        when last_inspection_date is null or new.date >= last_inspection_date
        then new.date
        else last_inspection_date
      end
    where id = new.vehicle_id;
  end if;
  return new;
end;
$$;
create trigger sync_vehicle_after_log
  after insert or update on public.maintenance_logs
  for each row execute procedure public.sync_vehicle_on_log();

create or replace function public.sync_vehicle_on_log_delete()
returns trigger language plpgsql security definer as $$
begin
  if old.type = 'oil_change' then
    update public.vehicles set
      last_oil_change_date = (
        select date from public.maintenance_logs
        where vehicle_id = old.vehicle_id and type = 'oil_change'
        order by date desc limit 1
      ),
      last_oil_change_mileage = (
        select mileage from public.maintenance_logs
        where vehicle_id = old.vehicle_id and type = 'oil_change' and mileage is not null
        order by date desc limit 1
      )
    where id = old.vehicle_id;
  elsif old.type = 'inspection' then
    update public.vehicles set
      last_inspection_date = (
        select date from public.maintenance_logs
        where vehicle_id = old.vehicle_id and type = 'inspection'
        order by date desc limit 1
      )
    where id = old.vehicle_id;
  end if;
  return old;
end;
$$;

create trigger sync_vehicle_after_log_delete
  after delete on public.maintenance_logs
  for each row execute procedure public.sync_vehicle_on_log_delete();

-- Appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_name text not null,
  shop_url text,
  scheduled_date date not null,
  scheduled_time time,
  service_type text not null,
  status text not null default 'scheduled',
  created_at timestamptz default now()
);
alter table public.appointments enable row level security;
create policy "Users manage own appointments" on public.appointments
  for all using (auth.uid() = user_id);

-- Emissions inspection columns
alter table public.vehicles
  add column if not exists emissions_enabled boolean not null default false,
  add column if not exists last_emissions_date date,
  add column if not exists emissions_interval_months integer not null default 24;

-- Update sync trigger to handle emissions_inspection log type
create or replace function public.sync_vehicle_on_log()
returns trigger language plpgsql security definer as $$
begin
  if new.type = 'oil_change' then
    update public.vehicles set
      last_oil_change_date = case when last_oil_change_date is null or new.date >= last_oil_change_date then new.date else last_oil_change_date end,
      last_oil_change_mileage = case when new.mileage is not null and (last_oil_change_date is null or new.date >= last_oil_change_date) then new.mileage else last_oil_change_mileage end,
      current_mileage = case when new.mileage is not null and new.mileage > current_mileage then new.mileage else current_mileage end
    where id = new.vehicle_id;
  elsif new.type = 'inspection' then
    update public.vehicles set
      last_inspection_date = case when last_inspection_date is null or new.date >= last_inspection_date then new.date else last_inspection_date end
    where id = new.vehicle_id;
  elsif new.type = 'emissions_inspection' then
    update public.vehicles set
      last_emissions_date = case when last_emissions_date is null or new.date >= last_emissions_date then new.date else last_emissions_date end
    where id = new.vehicle_id;
  end if;
  return new;
end;
$$;

-- Update delete-sync trigger to handle emissions_inspection log type
create or replace function public.sync_vehicle_on_log_delete()
returns trigger language plpgsql security definer as $$
begin
  if old.type = 'oil_change' then
    update public.vehicles set
      last_oil_change_date = (select date from public.maintenance_logs where vehicle_id = old.vehicle_id and type = 'oil_change' order by date desc limit 1),
      last_oil_change_mileage = (select mileage from public.maintenance_logs where vehicle_id = old.vehicle_id and type = 'oil_change' and mileage is not null order by date desc limit 1)
    where id = old.vehicle_id;
  elsif old.type = 'inspection' then
    update public.vehicles set
      last_inspection_date = (select date from public.maintenance_logs where vehicle_id = old.vehicle_id and type = 'inspection' order by date desc limit 1)
    where id = old.vehicle_id;
  elsif old.type = 'emissions_inspection' then
    update public.vehicles set
      last_emissions_date = (select date from public.maintenance_logs where vehicle_id = old.vehicle_id and type = 'emissions_inspection' order by date desc limit 1)
    where id = old.vehicle_id;
  end if;
  return old;
end;
$$;
