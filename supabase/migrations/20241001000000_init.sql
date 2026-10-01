-- Enable UUID helpers
create extension if not exists "pgcrypto";

create type public.user_role as enum ('supervisor', 'coordinador', 'cliente');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'supervisor',
  created_at timestamptz not null default now()
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid not null unique,
  supervisor_id uuid references public.profiles (id),
  site_name text not null,
  contracted_activity text not null default '',
  status text not null default 'pendiente'
    check (status in ('pendiente', 'en_curso', 'completada', 'novedad')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_lat double precision,
  check_out_lng double precision,
  notes text,
  novedad text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.visit_evidence (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references public.visits (id) on delete cascade not null,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger visits_set_updated_at
before update on public.visits
for each row
execute procedure public.set_updated_at();

create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  service_number text unique not null,
  customer_name text,
  status text not null default 'cotizacion',
  quote_json jsonb,
  created_at timestamptz not null default now()
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  service_number text,
  body text not null,
  photo_path text,
  vision_valid boolean,
  nlp_json jsonb,
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references public.visits (id) on delete set null,
  message text not null,
  severity text not null default 'info',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'supervisor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.flag_novedad_alert()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'novedad' and (old.status is distinct from 'novedad' or old.novedad is distinct from new.novedad) then
    insert into public.alerts (visit_id, message, severity)
    values (new.id, 'Novedad en ' || new.site_name || ': ' || coalesce(new.novedad, 'sin detalle'), 'alta');
  end if;
  return new;
end;
$$;

create trigger visits_novedad_alert
  after insert or update on public.visits
  for each row execute procedure public.flag_novedad_alert();

alter table public.profiles enable row level security;
alter table public.visits enable row level security;
alter table public.visit_evidence enable row level security;
alter table public.service_orders enable row level security;
alter table public.complaints enable row level security;
alter table public.alerts enable row level security;

create policy "own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "coordinador reads profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

create policy "supervisor owns visits" on public.visits
  for all using (supervisor_id = auth.uid())
  with check (supervisor_id = auth.uid());

create policy "coordinador all visits" on public.visits
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

create policy "evidence via visit" on public.visit_evidence
  for all using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (
          v.supervisor_id = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
        )
    )
  );

create policy "public service orders insert" on public.service_orders
  for insert with check (true);

create policy "read service orders" on public.service_orders
  for select using (true);

create policy "insert complaints" on public.complaints
  for insert with check (true);

create policy "coordinador complaints" on public.complaints
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

create policy "coordinador alerts" on public.alerts
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coordinador')
  );

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;
