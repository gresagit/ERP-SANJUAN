-- Consultorio San Juan
-- Migration 003: access requests reviewed by administrators
-- Run after 002_canalizaciones_y_roles.sql.

alter table public.profiles add column if not exists apellido text;
alter table public.profiles add column if not exists fecha_nacimiento date;

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'admin')
  );

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null,
  apellido text not null,
  fecha_nacimiento date not null,
  especialidad text not null,
  desempeno text not null,
  requested_role public.staff_role not null default 'doctor',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.access_requests enable row level security;
drop policy if exists "access_requests_insert_self" on public.access_requests;
drop policy if exists "access_requests_select_self_or_admin" on public.access_requests;
drop policy if exists "access_requests_update_admin" on public.access_requests;
create policy "access_requests_insert_self" on public.access_requests
  for insert with check (auth.uid() = user_id);
create policy "access_requests_select_self_or_admin" on public.access_requests
  for select using (
    auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'admin')
  );
create policy "access_requests_update_admin" on public.access_requests
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'admin'));

do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and c.relname = 'access_requests'
  ) then
    alter publication supabase_realtime add table public.access_requests;
  end if;
end $$;