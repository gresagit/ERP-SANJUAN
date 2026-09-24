-- =====================================================================
-- Consultorio San Juan — esquema de base de datos (Supabase / Postgres)
-- Ejecutar completo en: Supabase Dashboard > SQL Editor > New query
-- =====================================================================

create extension if not exists "pgcrypto";

do $$ begin
  create type public.staff_role as enum ('admin','doctor','enfermera','fisioterapeuta','nutriologo','farmacia','recepcion');
exception when duplicate_object then null; end $$;

alter type public.staff_role add value if not exists 'fisioterapeuta';
alter type public.staff_role add value if not exists 'nutriologo';

-- ---------------------------------------------------------------------
-- PROFILES: un registro por usuario de Supabase Auth (personal del consultorio)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  apellido text,
  fecha_nacimiento date,
  rol public.staff_role not null default 'recepcion',
  especialidad text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles add column if not exists apellido text;
alter table public.profiles add column if not exists fecha_nacimiento date;

drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff" on public.profiles
  for select using (auth.uid() is not null);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'admin')
  );

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
-- ACCESS_REQUESTS (solicitudes de alta revisadas por administradores)
-- ---------------------------------------------------------------------
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
drop policy if exists "pacientes_staff_select" on public.pacientes;
drop policy if exists "pacientes_staff_insert" on public.pacientes;
drop policy if exists "pacientes_staff_update" on public.pacientes;

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
drop policy if exists "consultas_staff_select" on public.consultas;
drop policy if exists "consultas_doctor_insert" on public.consultas;
drop policy if exists "consultas_staff_update" on public.consultas;

-- ---------------------------------------------------------------------
-- REFERRAL_REQUESTS (aceptación previa para especialistas y enfermería)
-- ---------------------------------------------------------------------
create table if not exists public.referral_requests (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  paciente_nombre text not null,
  consulta_id uuid references public.consultas(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  sender_nombre text not null,
  recipient_id uuid not null references public.profiles(id),
  recipient_nombre text not null,
  area text not null,
  motivo text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
alter table public.referral_requests enable row level security;
drop policy if exists "referrals_select_involved" on public.referral_requests;
create policy "referrals_select_involved" on public.referral_requests
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
drop policy if exists "referrals_insert_sender" on public.referral_requests;
create policy "referrals_insert_sender" on public.referral_requests
  for insert with check (public.is_staff() and auth.uid() = sender_id);
drop policy if exists "referrals_update_recipient" on public.referral_requests;
create policy "referrals_update_recipient" on public.referral_requests
  for update using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create or replace function public.can_access_patient(target_patient_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol in ('admin', 'doctor')
  ) or exists (
    select 1 from public.referral_requests r
    where r.paciente_id = target_patient_id
      and r.recipient_id = auth.uid()
      and r.status = 'accepted'
  );
$$;

create policy "pacientes_staff_select" on public.pacientes
  for select using (public.is_staff() and public.can_access_patient(id));
create policy "pacientes_staff_insert" on public.pacientes
  for insert with check (public.is_staff());
create policy "pacientes_staff_update" on public.pacientes
  for update using (public.is_staff() and public.can_access_patient(id)) with check (public.is_staff() and public.can_access_patient(id));

create policy "consultas_staff_select" on public.consultas
  for select using (public.is_staff() and public.can_access_patient(paciente_id));
create policy "consultas_doctor_insert" on public.consultas
  for insert with check (public.is_staff() and doctor_id = auth.uid());
create policy "consultas_staff_update" on public.consultas
  for update using (public.is_staff() and public.can_access_patient(paciente_id)) with check (public.is_staff() and public.can_access_patient(paciente_id));

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
create policy "recetas_staff_select" on public.recetas
  for select using (public.is_staff() and public.can_access_patient(paciente_id));
create policy "recetas_doctor_insert" on public.recetas
  for insert with check (public.is_staff() and doctor_id = auth.uid());
create policy "recetas_doctor_update" on public.recetas
  for update using (public.is_staff() and doctor_id = auth.uid()) with check (public.is_staff() and doctor_id = auth.uid());

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
alter publication supabase_realtime add table public.referral_requests;
alter publication supabase_realtime add table public.citas;
alter publication supabase_realtime add table public.medicamentos;
alter publication supabase_realtime add table public.ventas;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.access_requests;

-- =====================================================================
-- NOTA SOBRE EL PRIMER ADMIN
-- Después de registrar tu primer usuario desde la app (pantalla de
-- registro) y completar tu perfil, sube tu propio rol a 'admin' con:
--
--   update public.profiles set rol = 'admin' where id =
--     (select id from auth.users where email = 'tu-correo@ejemplo.com');
-- =====================================================================
