alter table vehicles
  add column if not exists oil_change_interval_months integer not null default 4;
