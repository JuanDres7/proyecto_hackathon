create sequence if not exists public.service_code_seq start with 3000;

create or replace function public.next_service_code()
returns integer
language sql
security definer
set search_path = public
as $$
  select nextval('public.service_code_seq')::integer;
$$;

revoke all on function public.next_service_code() from public;
grant execute on function public.next_service_code() to service_role;

alter table public.service_orders
  add column if not exists customer_document text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists opening_message text,
  add column if not exists services text[] not null default '{}',
  add column if not exists scheduled_at timestamptz,
  add column if not exists location text,
  add column if not exists access_notes text,
  add column if not exists cancellation_reason text,
  add column if not exists supervisor_id uuid references public.profiles (id),
  add column if not exists en_route_at timestamptz;

update public.service_orders
set status = 'draft'
where status not in ('draft', 'pending_confirmation', 'confirmed', 'cancelled');

alter table public.service_orders
  alter column status set default 'draft';

alter table public.service_orders
  drop constraint if exists service_orders_status_check;

alter table public.service_orders
  add constraint service_orders_status_check
  check (status in ('draft', 'pending_confirmation', 'confirmed', 'cancelled'));

alter table public.service_orders
  drop constraint if exists service_orders_cancellation_reason_check;

alter table public.service_orders
  add constraint service_orders_cancellation_reason_check
  check (
    (status = 'cancelled' and cancellation_reason in ('data_error', 'plans_changed', 'too_expensive', 'other'))
    or (status <> 'cancelled' and cancellation_reason is null)
  );

alter table public.service_orders
  drop constraint if exists service_orders_services_check;

alter table public.service_orders
  add constraint service_orders_services_check
  check (
    status not in ('pending_confirmation', 'confirmed')
    or (
      cardinality(services) >= 1
      and services <@ array['aseo_general', 'jardineria', 'limpieza_piscinas']::text[]
    )
  );

alter table public.visits
  add column if not exists service_number text;

create index if not exists visits_service_number_idx on public.visits (service_number);

alter table public.complaints
  add column if not exists rating smallint,
  add column if not exists label text,
  add column if not exists confidence smallint,
  add column if not exists vision_note text,
  add column if not exists summary text;

alter table public.complaints
  drop constraint if exists complaints_rating_check;

alter table public.complaints
  add constraint complaints_rating_check
  check (rating is null or rating between 1 and 5);

alter table public.complaints
  drop constraint if exists complaints_label_check;

alter table public.complaints
  add constraint complaints_label_check
  check (
    label is null
    or label in ('inasistencia', 'calidad', 'conducta', 'facturacion', 'seguridad', 'general', 'pending')
  );

alter table public.complaints
  drop constraint if exists complaints_confidence_check;

alter table public.complaints
  add constraint complaints_confidence_check
  check (confidence is null or confidence between 0 and 100);

create unique index if not exists complaints_service_number_unique
  on public.complaints (service_number)
  where service_number is not null;

create table if not exists public.pqr_cases (
  id uuid primary key default gen_random_uuid(),
  service_number text not null unique,
  priority text not null default 'alta' check (priority = 'alta'),
  status text not null default 'open' check (status = 'open'),
  opened_at timestamptz not null default now()
);

create table if not exists public.chat_turns (
  id uuid primary key default gen_random_uuid(),
  service_number text,
  draft_id uuid,
  phase text not null check (phase in ('cotizacion', 'progreso', 'finalizacion')),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.pqr_cases enable row level security;
alter table public.chat_turns enable row level security;

drop policy if exists "public update service orders" on public.service_orders;
create policy "public update service orders" on public.service_orders
  for update using (true) with check (true);

drop policy if exists "public insert chat turns" on public.chat_turns;
create policy "public insert chat turns" on public.chat_turns
  for insert with check (true);

drop policy if exists "public read chat turns" on public.chat_turns;
create policy "public read chat turns" on public.chat_turns
  for select using (true);

drop policy if exists "public insert pqr" on public.pqr_cases;
create policy "public insert pqr" on public.pqr_cases
  for insert with check (true);

drop policy if exists "coordinador reads pqr" on public.pqr_cases;
create policy "coordinador reads pqr" on public.pqr_cases
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'coordinador'
    )
  );

drop policy if exists "public read complaints" on public.complaints;
create policy "public read complaints" on public.complaints
  for select using (true);
