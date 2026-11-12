-- Hardening for security definer functions (Supabase Security Advisor lint 0011).
-- Apply manually in the Supabase SQL editor. Safe to run more than once.

-- 1. Pin search_path so a definer function can't be tricked into resolving
--    objects from another schema.
alter function public.sync_vehicle_on_log() set search_path = public;
alter function public.sync_vehicle_on_log_delete() set search_path = public;
alter function public.handle_new_user() set search_path = public;

-- 2. Definer functions are executable by PUBLIC (incl. signed-out "anon") by
--    default. complete_appointment already rejects callers who don't own the
--    appointment; this also stops anon from calling it at all.
revoke execute on function public.complete_appointment(uuid, integer) from public, anon;
grant execute on function public.complete_appointment(uuid, integer) to authenticated;
