-- Role helpers (avoid recursive RLS on profiles)
create or replace function public.is_coordinator()
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

create or replace function public.is_supervisor()
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

create or replace function public.is_staff()
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

revoke all on function public.is_coordinator() from public;
revoke all on function public.is_supervisor() from public;
revoke all on function public.is_staff() from public;
grant execute on function public.is_coordinator() to authenticated;
grant execute on function public.is_supervisor() to authenticated;
grant execute on function public.is_staff() to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Recreate policies without recursive profiles scans
drop policy if exists "coordinador reads profiles" on public.profiles;
create policy "coordinador reads profiles" on public.profiles
  for select using (public.is_coordinator());

drop policy if exists "coordinador all visits" on public.visits;
create policy "coordinador all visits" on public.visits
  for select using (public.is_coordinator());

drop policy if exists "coordinator update visits" on public.visits;
create policy "coordinator update visits" on public.visits
  for update using (public.is_coordinator())
  with check (public.is_coordinator());

drop policy if exists "evidence via visit" on public.visit_evidence;
create policy "evidence via visit" on public.visit_evidence
  for all using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (v.supervisor_id = auth.uid() or public.is_coordinator())
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (v.supervisor_id = auth.uid() or public.is_coordinator())
    )
  );

drop policy if exists "coordinador complaints" on public.complaints;
create policy "coordinador complaints" on public.complaints
  for select using (public.is_coordinator());

drop policy if exists "coordinador alerts" on public.alerts;
create policy "coordinador alerts" on public.alerts
  for select using (public.is_coordinator());

drop policy if exists "coordinator update alerts" on public.alerts;
create policy "coordinator update alerts" on public.alerts
  for update using (public.is_coordinator())
  with check (public.is_coordinator());

drop policy if exists "coordinador pqr" on public.pqr_cases;
create policy "coordinador pqr" on public.pqr_cases
  for select using (public.is_coordinator());

drop policy if exists "coordinator insert pqr" on public.pqr_cases;
create policy "coordinator insert pqr" on public.pqr_cases
  for insert with check (public.is_coordinator());

drop policy if exists "staff read orders" on public.service_orders;
create policy "staff read orders" on public.service_orders
  for select using (public.is_staff());

drop policy if exists "coordinator update orders" on public.service_orders;
create policy "coordinator update orders" on public.service_orders
  for update using (public.is_coordinator())
  with check (public.is_coordinator());

drop policy if exists "own assignments" on public.visit_assignments;
create policy "own assignments" on public.visit_assignments
  for select using (supervisor_id = auth.uid() or public.is_coordinator());

drop policy if exists "coordinator write assignments" on public.visit_assignments;
create policy "coordinator write assignments" on public.visit_assignments
  for all using (public.is_coordinator())
  with check (public.is_coordinator());

drop policy if exists "visit activity via visit" on public.visit_activity_results;
create policy "visit activity via visit" on public.visit_activity_results
  for all using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (v.supervisor_id = auth.uid() or public.is_coordinator())
    )
  )
  with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (v.supervisor_id = auth.uid() or public.is_coordinator())
    )
  );

drop policy if exists "coordinator incidents" on public.incidents;
create policy "coordinator incidents" on public.incidents
  for all using (public.is_coordinator())
  with check (public.is_coordinator());

drop policy if exists "coordinator audit" on public.audit_log;
create policy "coordinator audit" on public.audit_log
  for select using (public.is_coordinator());

-- Link visit ↔ order and close lat/lng ranges
do $$
begin
  alter table public.visits
    add constraint visits_check_out_lat_range check (check_out_lat is null or check_out_lat between -90 and 90);
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table public.visits
    add constraint visits_check_out_lng_range check (check_out_lng is null or check_out_lng between -180 and 180);
exception when duplicate_object then null;
end $$;

create or replace function public.link_visit_service_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.service_number is not null and new.service_order_id is null then
    select id into new.service_order_id
    from public.service_orders
    where service_number = new.service_number
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists visits_link_order on public.visits;
create trigger visits_link_order
before insert or update of service_number on public.visits
for each row execute procedure public.link_visit_service_order();

-- Novedad: persist alert_id on incident
create or replace function public.flag_novedad_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sev text;
  v_alert uuid;
begin
  if new.status = 'novedad' and (old.status is distinct from 'novedad' or old.novedad is distinct from new.novedad) then
    sev := case coalesce(new.novedad_priority, 'alta')
      when 'baja' then 'baja'
      when 'media' then 'media'
      else 'alta'
    end;
    insert into public.alerts (visit_id, message, severity, status)
    values (
      new.id,
      'Novedad en ' || new.site_name || ': ' || coalesce(new.novedad, 'sin detalle'),
      sev,
      'open'
    )
    returning id into v_alert;

    insert into public.incidents (visit_id, alert_id, priority, status, body)
    values (new.id, v_alert, coalesce(new.novedad_priority, 'alta'), 'open', coalesce(new.novedad, 'sin detalle'));
  end if;
  return new;
end;
$$;

revoke all on function public.flag_novedad_alert() from public, anon, authenticated;

create or replace function public.confirm_service_draft(p_draft jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_draft_id text := p_draft->>'draftId';
  v_id uuid;
  v_services text[];
begin
  v_services := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_draft->'services', '[]'::jsonb))),
    '{}'
  );

  select id, service_number into v_id, v_code
  from public.service_orders
  where quote_json->>'draftId' = v_draft_id
  limit 1
  for update;

  if v_code is null or v_code like 'draft-%' then
    v_code := public.issue_service_number();
  end if;

  if v_id is null then
    insert into public.service_orders (
      service_number, customer_name, customer_document, email, phone,
      opening_message, services, scheduled_at, location, access_notes,
      status, quote_json
    ) values (
      v_code,
      p_draft->>'customerName',
      p_draft->>'customerDocument',
      p_draft->>'email',
      p_draft->>'phone',
      p_draft->>'openingMessage',
      v_services,
      nullif(p_draft->>'scheduledAt', '')::timestamptz,
      p_draft->>'location',
      p_draft->>'accessNotes',
      'confirmed',
      jsonb_build_object('draftId', v_draft_id)
    );
  else
    update public.service_orders set
      service_number = v_code,
      customer_name = p_draft->>'customerName',
      customer_document = p_draft->>'customerDocument',
      email = p_draft->>'email',
      phone = p_draft->>'phone',
      opening_message = p_draft->>'openingMessage',
      services = v_services,
      scheduled_at = nullif(p_draft->>'scheduledAt', '')::timestamptz,
      location = p_draft->>'location',
      access_notes = p_draft->>'accessNotes',
      status = 'confirmed',
      quote_json = jsonb_build_object('draftId', v_draft_id)
    where id = v_id;
  end if;

  return v_code;
end;
$$;

revoke all on function public.confirm_service_draft(jsonb) from public, anon, authenticated;
grant execute on function public.confirm_service_draft(jsonb) to service_role;

-- Storage: private bucket usable by signed-in staff
insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

drop policy if exists "evidencias insert authenticated" on storage.objects;
create policy "evidencias insert authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias');

drop policy if exists "evidencias update authenticated" on storage.objects;
create policy "evidencias update authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'evidencias')
  with check (bucket_id = 'evidencias');

drop policy if exists "evidencias select authenticated" on storage.objects;
create policy "evidencias select authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'evidencias');

-- Realtime payload for updates
alter table public.visits replica identity full;
alter table public.alerts replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

create index if not exists service_orders_supervisor_idx on public.service_orders (supervisor_id);
create index if not exists service_orders_status_idx on public.service_orders (status);
create index if not exists alerts_status_idx on public.alerts (status);
