-- Hide SECURITY DEFINER helpers from PostgREST (/rest/v1/rpc) while keeping them
-- available to RLS. Do not expose schema `internal` in config.toml [api].schemas.

create schema if not exists internal;
revoke all on schema internal from public;
revoke all on schema internal from anon;
grant usage on schema internal to authenticated, service_role;

create or replace function internal.is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'coordinador'
  );
$$;

create or replace function internal.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'supervisor'
  );
$$;

create or replace function internal.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordinador', 'supervisor')
  );
$$;

revoke all on function internal.is_coordinator() from public, anon;
revoke all on function internal.is_supervisor() from public, anon;
revoke all on function internal.is_staff() from public, anon;
grant execute on function internal.is_coordinator() to authenticated, service_role;
grant execute on function internal.is_supervisor() to authenticated, service_role;
grant execute on function internal.is_staff() to authenticated, service_role;

drop policy if exists "coordinador reads profiles" on public.profiles;
create policy "coordinador reads profiles" on public.profiles
  for select using (internal.is_coordinator());

drop policy if exists "coordinador all visits" on public.visits;
create policy "coordinador all visits" on public.visits
  for select using (internal.is_coordinator());

drop policy if exists "coordinator update visits" on public.visits;
create policy "coordinator update visits" on public.visits
  for update using (internal.is_coordinator())
  with check (internal.is_coordinator());

drop policy if exists "evidence via visit" on public.visit_evidence;
create policy "evidence via visit" on public.visit_evidence
  for all using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (v.supervisor_id = auth.uid() or internal.is_coordinator())
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (v.supervisor_id = auth.uid() or internal.is_coordinator())
    )
  );

drop policy if exists "coordinador complaints" on public.complaints;
create policy "coordinador complaints" on public.complaints
  for select using (internal.is_coordinator());

drop policy if exists "coordinador alerts" on public.alerts;
create policy "coordinador alerts" on public.alerts
  for select using (internal.is_coordinator());

drop policy if exists "coordinator update alerts" on public.alerts;
create policy "coordinator update alerts" on public.alerts
  for update using (internal.is_coordinator())
  with check (internal.is_coordinator());

drop policy if exists "coordinador pqr" on public.pqr_cases;
create policy "coordinador pqr" on public.pqr_cases
  for select using (internal.is_coordinator());

drop policy if exists "coordinator insert pqr" on public.pqr_cases;
create policy "coordinator insert pqr" on public.pqr_cases
  for insert with check (internal.is_coordinator());

drop policy if exists "staff read orders" on public.service_orders;
create policy "staff read orders" on public.service_orders
  for select using (internal.is_staff());

drop policy if exists "coordinator update orders" on public.service_orders;
create policy "coordinator update orders" on public.service_orders
  for update using (internal.is_coordinator())
  with check (internal.is_coordinator());

drop policy if exists "own assignments" on public.visit_assignments;
create policy "own assignments" on public.visit_assignments
  for select using (supervisor_id = auth.uid() or internal.is_coordinator());

drop policy if exists "coordinator write assignments" on public.visit_assignments;
create policy "coordinator write assignments" on public.visit_assignments
  for all using (internal.is_coordinator())
  with check (internal.is_coordinator());

drop policy if exists "visit activity via visit" on public.visit_activity_results;
create policy "visit activity via visit" on public.visit_activity_results
  for all using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (v.supervisor_id = auth.uid() or internal.is_coordinator())
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (v.supervisor_id = auth.uid() or internal.is_coordinator())
    )
  );

drop policy if exists "coordinator incidents" on public.incidents;
create policy "coordinator incidents" on public.incidents
  for all using (internal.is_coordinator())
  with check (internal.is_coordinator());

drop policy if exists "coordinator audit" on public.audit_log;
create policy "coordinator audit" on public.audit_log
  for select using (internal.is_coordinator());

drop function if exists public.is_coordinator();
drop function if exists public.is_supervisor();
drop function if exists public.is_staff();

do $$
begin
  execute 'revoke all on function public.link_visit_service_order() from public, anon, authenticated';
exception
  when undefined_function then null;
end $$;

do $$
begin
  execute 'revoke all on function public.flag_novedad_alert() from public, anon, authenticated';
exception
  when undefined_function then null;
end $$;
