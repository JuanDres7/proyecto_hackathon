create sequence if not exists public.service_code_seq start with 3000;

alter table public.visits
  add column if not exists service_number text,
  add column if not exists novedad_priority text;

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

alter table public.service_orders
  alter column status set default 'draft';

update public.service_orders set status = 'draft' where status = 'cotizacion';

alter table public.complaints
  add column if not exists rating smallint,
  add column if not exists label text,
  add column if not exists confidence smallint,
  add column if not exists vision_note text,
  add column if not exists summary text;

create unique index if not exists complaints_service_number_uidx
  on public.complaints (service_number)
  where service_number is not null;

create table if not exists public.pqr_cases (
  id uuid primary key default gen_random_uuid(),
  service_number text not null unique,
  priority text not null default 'alta',
  status text not null default 'open',
  opened_at timestamptz not null default now()
);

create table if not exists public.chat_turns (
  id uuid primary key default gen_random_uuid(),
  service_number text,
  draft_id uuid,
  phase text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.pqr_cases enable row level security;
alter table public.chat_turns enable row level security;

drop policy if exists "coordinador pqr" on public.pqr_cases;
create policy "coordinador pqr" on public.pqr_cases
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

drop policy if exists "insert chat turns" on public.chat_turns;
create policy "insert chat turns" on public.chat_turns
  for insert with check (true);

drop policy if exists "read own chat turns" on public.chat_turns;
create policy "read own chat turns" on public.chat_turns
  for select using (true);

create or replace function public.issue_service_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  n := nextval('public.service_code_seq');
  return '#' || n::text;
end;
$$;

revoke all on function public.issue_service_number() from public;
revoke all on function public.issue_service_number() from anon;
revoke all on function public.issue_service_number() from authenticated;
grant execute on function public.issue_service_number() to service_role;
