-- =====================================================================
-- Consultorio San Juan — esquema de base de datos (Supabase / Postgres)
-- Ejecutar completo en: Supabase Dashboard > SQL Editor > New query
-- =====================================================================

create extension if not exists "pgcrypto";

do $$ begin
  create type public.staff_role as enum ('admin','doctor','enfermera','farmacia','recepcion');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- PROFILES: un registro por usuario de Supabase Auth (personal del consultorio)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol public.staff_role not null default 'recepcion',
  especialidad text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff" on public.profiles
  for select using (auth.uid() is not null);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'admin')
  );

-- Helper: ¿el usuario autenticado tiene un perfil (es personal del consultorio)?
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- PACIENTES
-- ---------------------------------------------------------------------
create table if not exists public.pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_nacimiento date,
  sexo text,
  telefono text,
  domicilio text,
  alergias text,
  antecedentes_hf text,
  antecedentes_pp text,
  antecedentes_pnp text,
  creado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.pacientes enable row level security;
drop policy if exists "pacientes_staff_all" on public.pacientes;
create policy "pacientes_staff_all" on public.pacientes
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- CONSULTAS (notas de evolución / expediente)
-- ---------------------------------------------------------------------
create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  doctor_id uuid references public.profiles(id),
  doctor_nombre text,
  fecha date not null default current_date,
  motivo text,
  exploracion text,
  diagnostico text,
  tratamiento text,
  requiere_enfermera boolean not null default false,
  enfermeria_estado text,
  enfermera_id uuid references public.profiles(id),
  canaliza_area text,
  canaliza_profesional_id uuid references public.profiles(id),
  canaliza_profesional_nombre text,
  canaliza_motivo text,
  canaliza_estado text default 'pendiente',
  created_at timestamptz not null default now()
);
alter table public.consultas enable row level security;
drop policy if exists "consultas_staff_all" on public.consultas;
create policy "consultas_staff_all" on public.consultas
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- RECETAS (indicaciones médicas por paciente)
-- ---------------------------------------------------------------------
create table if not exists public.recetas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  consulta_id uuid references public.consultas(id) on delete set null,
  doctor_id uuid references public.profiles(id),
  doctor_nombre text,
  fecha date not null default current_date,
  medicamento text not null,
  dosis text not null,
  frecuencia text not null,
  duracion text not null,
  indicaciones text,
  created_at timestamptz not null default now()
);
alter table public.recetas enable row level security;
drop policy if exists "recetas_staff_all" on public.recetas;
create policy "recetas_staff_all" on public.recetas
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- CITAS (agenda)
-- ---------------------------------------------------------------------
create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid references public.profiles(id),
  profesional_nombre text,
  paciente_id uuid references public.pacientes(id),
  paciente_nombre text not null,
  fecha date not null,
  hora time not null,
  motivo text,
  estado text not null default 'pendiente',
  created_at timestamptz not null default now()
);
alter table public.citas enable row level security;
drop policy if exists "citas_staff_all" on public.citas;
create policy "citas_staff_all" on public.citas
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- MEDICAMENTOS (farmacia)
-- ---------------------------------------------------------------------
create table if not exists public.medicamentos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  presentacion text,
  stock integer not null default 0,
  precio numeric(10,2) not null default 0,
  caducidad date,
  created_at timestamptz not null default now()
);
alter table public.medicamentos enable row level security;
drop policy if exists "medicamentos_staff_all" on public.medicamentos;
create policy "medicamentos_staff_all" on public.medicamentos
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- VENTAS + VENTA_ITEMS (tickets)
-- ---------------------------------------------------------------------
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  folio text not null,
  total numeric(10,2) not null,
  fecha date not null default current_date,
  hora time not null default current_time,
  vendedor_id uuid references public.profiles(id),
  vendedor_nombre text,
  created_at timestamptz not null default now()
);
alter table public.ventas enable row level security;
drop policy if exists "ventas_staff_all" on public.ventas;
create policy "ventas_staff_all" on public.ventas
  for all using (public.is_staff()) with check (public.is_staff());

create table if not exists public.venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas(id) on delete cascade,
  medicamento_id uuid references public.medicamentos(id),
  nombre text not null,
  cantidad integer not null,
  precio numeric(10,2) not null
);
alter table public.venta_items enable row level security;
drop policy if exists "venta_items_staff_all" on public.venta_items;
create policy "venta_items_staff_all" on public.venta_items
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- Realtime: permite que todos los dispositivos vean cambios en vivo
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.pacientes;
alter publication supabase_realtime add table public.consultas;
alter publication supabase_realtime add table public.recetas;
alter publication supabase_realtime add table public.citas;
alter publication supabase_realtime add table public.medicamentos;
alter publication supabase_realtime add table public.ventas;
alter publication supabase_realtime add table public.profiles;

-- =====================================================================
-- NOTA SOBRE EL PRIMER ADMIN
-- Después de registrar tu primer usuario desde la app (pantalla de
-- registro) y completar tu perfil, sube tu propio rol a 'admin' con:
--
--   update public.profiles set rol = 'admin' where id =
--     (select id from auth.users where email = 'tu-correo@ejemplo.com');
-- =====================================================================
