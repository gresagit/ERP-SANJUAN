-- Consultorio San Juan
-- Migration 001: prescription records
-- Run once against an existing Supabase project.

create table if not exists public.recetas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  consulta_id uuid references public.consultas(id) on delete set null,
  doctor_id uuid references public.profiles(id),
  doctor_nombre text,
  fecha date not null default current_date,
  diagnostico text not null default '',
  tratamiento text not null default '',
  medicamento text not null,
  dosis text not null,
  frecuencia text not null,
  duracion text not null,
  indicaciones text,
  created_at timestamptz not null default now()
);

alter table public.recetas add column if not exists diagnostico text not null default '';
alter table public.recetas add column if not exists tratamiento text not null default '';
alter table public.recetas enable row level security;

drop policy if exists "recetas_staff_all" on public.recetas;
drop policy if exists "recetas_staff_select" on public.recetas;
drop policy if exists "recetas_doctor_insert" on public.recetas;
drop policy if exists "recetas_doctor_update" on public.recetas;

create policy "recetas_staff_all" on public.recetas
  for all using (public.is_staff()) with check (public.is_staff());

do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and c.relname = 'recetas'
  ) then
    alter publication supabase_realtime add table public.recetas;
  end if;
end $$;
