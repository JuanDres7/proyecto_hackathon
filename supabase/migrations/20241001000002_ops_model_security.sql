-- Search path (linter function_search_path_mutable)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Domain tables
create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  geofence_radius_m integer not null default 120 check (geofence_radius_m between 20 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  cost_center_id uuid not null references public.cost_centers (id) on delete cascade,
  title text not null,
  subtitle text,
  sort_order int not null default 0,
  unique (cost_center_id, title)
);

alter table public.service_orders
  add column if not exists cost_center_id uuid references public.cost_centers (id),
  add column if not exists route_date date,
  add column if not exists assigned_by uuid references public.profiles (id),
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'simulated_paid')),
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists service_orders_set_updated_at on public.service_orders;
create trigger service_orders_set_updated_at
before update on public.service_orders
for each row execute procedure public.set_updated_at();

create table if not exists public.visit_assignments (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders (id) on delete cascade,
  supervisor_id uuid not null references public.profiles (id),
  assigned_by uuid references public.profiles (id),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  route_order int not null default 0,
  status text not null default 'asignada'
    check (status in ('asignada', 'en_ruta', 'en_sitio', 'cerrada', 'cancelada')),
  created_at timestamptz not null default now(),
  unique (service_order_id, supervisor_id)
);

alter table public.visits
  add column if not exists service_order_id uuid references public.service_orders (id),
  add column if not exists cost_center_id uuid references public.cost_centers (id),
  add column if not exists assignment_id uuid references public.visit_assignments (id),
  add column if not exists site_lat double precision check (site_lat is null or site_lat between -90 and 90),
  add column if not exists site_lng double precision check (site_lng is null or site_lng between -180 and 180),
  add column if not exists geofence_radius_m integer default 120,
  add column if not exists check_in_accuracy_m double precision,
  add column if not exists gps_mocked boolean,
  add column if not exists sync_status text not null default 'pending'
    check (sync_status in ('pending', 'syncing', 'synced', 'error')),
  add column if not exists identity_verified boolean not null default false;

do $$
begin
  alter table public.visits
    add constraint visits_check_in_lat_range check (check_in_lat is null or check_in_lat between -90 and 90);
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table public.visits
    add constraint visits_check_in_lng_range check (check_in_lng is null or check_in_lng between -180 and 180);
exception when duplicate_object then null;
end $$;

create index if not exists visits_service_number_idx on public.visits (service_number);
create index if not exists visits_supervisor_idx on public.visits (supervisor_id);
create index if not exists visits_status_idx on public.visits (status);
create index if not exists visits_updated_at_idx on public.visits (updated_at desc);

create table if not exists public.visit_activity_results (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  activity_id uuid references public.activities (id),
  title text not null,
  status text not null default 'pending'
    check (status in ('pending', 'progress', 'completed', 'blocked')),
  notes text,
  updated_at timestamptz not null default now(),
  unique (visit_id, title)
);

alter table public.visit_evidence
  add column if not exists content_hash text,
  add column if not exists client_uuid uuid;

create unique index if not exists visit_evidence_visit_path_uidx
  on public.visit_evidence (visit_id, storage_path);

create unique index if not exists visit_evidence_hash_uidx
  on public.visit_evidence (visit_id, content_hash)
  where content_hash is not null;

alter table public.alerts
  add column if not exists status text not null default 'open'
    check (status in ('open', 'ack', 'closed')),
  add column if not exists coordinator_comment text,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles (id);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references public.visits (id) on delete set null,
  alert_id uuid references public.alerts (id) on delete set null,
  priority text not null default 'alta' check (priority in ('alta', 'media', 'baja')),
  status text not null default 'open' check (status in ('open', 'ack', 'closed')),
  body text not null,
  coordinator_comment text,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles (id),
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'push')),
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- Alerts: severity from novedad_priority
create or replace function public.flag_novedad_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare sev text;
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
    );
    insert into public.incidents (visit_id, priority, status, body)
    values (new.id, coalesce(new.novedad_priority, 'alta'), 'open', coalesce(new.novedad, 'sin detalle'));
  end if;
  return new;
end;
$$;

drop trigger if exists visits_novedad_alert on public.visits;
create trigger visits_novedad_alert
  after insert or update on public.visits
  for each row execute procedure public.flag_novedad_alert();

-- Confirm draft atomically
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
begin
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
      coalesce(array(select jsonb_array_elements_text(p_draft->'services')), '{}'),
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
      services = coalesce(array(select jsonb_array_elements_text(p_draft->'services')), '{}'),
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

create or replace function public.simulate_payment(p_service_number text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.service_orders
  set payment_status = 'simulated_paid'
  where service_number = p_service_number;
  return found;
end;
$$;

revoke all on function public.simulate_payment(text) from public, anon, authenticated;
grant execute on function public.simulate_payment(text) to service_role;

revoke all on function public.flag_novedad_alert() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.visits;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.alerts;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- RLS: drop overly permissive policies
drop policy if exists "public service orders insert" on public.service_orders;
drop policy if exists "read service orders" on public.service_orders;
drop policy if exists "insert complaints" on public.complaints;
drop policy if exists "insert chat turns" on public.chat_turns;
drop policy if exists "read own chat turns" on public.chat_turns;

create policy "staff read orders" on public.service_orders
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('coordinador', 'supervisor'))
  );

create policy "coordinator update orders" on public.service_orders
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

create policy "supervisor assigned orders" on public.service_orders
  for update using (supervisor_id = auth.uid())
  with check (supervisor_id = auth.uid());

create policy "coordinator update visits" on public.visits
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

create policy "coordinator insert pqr" on public.pqr_cases
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

create policy "staff read cost centers" on public.cost_centers
  for select using (auth.uid() is not null);

create policy "staff read activities" on public.activities
  for select using (auth.uid() is not null);

create policy "own assignments" on public.visit_assignments
  for select using (
    supervisor_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

create policy "coordinator write assignments" on public.visit_assignments
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

create policy "visit activity via visit" on public.visit_activity_results
  for all using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (v.supervisor_id = auth.uid() or exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador'
        ))
    )
  );

alter table public.cost_centers enable row level security;
alter table public.activities enable row level security;
alter table public.visit_assignments enable row level security;
alter table public.visit_activity_results enable row level security;
alter table public.incidents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

create policy "coordinator incidents" on public.incidents
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

create policy "own notifications" on public.notifications
  for select using (recipient_id = auth.uid());

create policy "coordinator audit" on public.audit_log
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

create policy "coordinator update alerts" on public.alerts
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

-- Seed demo catalog (no auth.users required)
insert into public.cost_centers (code, name, address, lat, lng, geofence_radius_m)
values
  ('CC-BOG-01', 'Planta Bogotá Norte', 'Calle 170 #15-20, Bogotá', 4.7642, -74.0465, 120),
  ('CC-MED-01', 'Centro logístico Medellín', 'Cra 50 #12-00, Medellín', 6.2308, -75.5905, 150)
on conflict (code) do nothing;

insert into public.activities (cost_center_id, title, subtitle, sort_order)
select c.id, a.title, a.subtitle, a.sort_order
from public.cost_centers c
cross join (
  values
    ('Verificación de cableado de potencia principal', 'Protocolo RETIE', 1),
    ('Inspección de fugas en transformador auxiliar', 'Ejecución in-situ', 2),
    ('Medición de resistencia de puesta a tierra', 'Telurómetro calibrado', 3)
) as a(title, subtitle, sort_order)
where c.code = 'CC-BOG-01'
on conflict do nothing;
