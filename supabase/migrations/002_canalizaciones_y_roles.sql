-- Consultorio San Juan
-- Migration 002: specialist roles and referral acceptance workflow
-- Run after 001_receta_medica.sql.

alter type public.staff_role add value if not exists 'fisioterapeuta';
alter type public.staff_role add value if not exists 'nutriologo';

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
drop policy if exists "referrals_insert_sender" on public.referral_requests;
drop policy if exists "referrals_update_recipient" on public.referral_requests;

create policy "referrals_select_involved" on public.referral_requests
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "referrals_insert_sender" on public.referral_requests
  for insert with check (public.is_staff() and auth.uid() = sender_id);
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

alter table public.pacientes enable row level security;
drop policy if exists "pacientes_staff_all" on public.pacientes;
drop policy if exists "pacientes_staff_select" on public.pacientes;
drop policy if exists "pacientes_staff_insert" on public.pacientes;
drop policy if exists "pacientes_staff_update" on public.pacientes;
create policy "pacientes_staff_select" on public.pacientes
  for select using (public.is_staff() and public.can_access_patient(id));
create policy "pacientes_staff_insert" on public.pacientes
  for insert with check (public.is_staff());
create policy "pacientes_staff_update" on public.pacientes
  for update using (public.is_staff() and public.can_access_patient(id))
  with check (public.is_staff() and public.can_access_patient(id));

alter table public.consultas enable row level security;
drop policy if exists "consultas_staff_all" on public.consultas;
drop policy if exists "consultas_staff_select" on public.consultas;
drop policy if exists "consultas_doctor_insert" on public.consultas;
drop policy if exists "consultas_staff_update" on public.consultas;
create policy "consultas_staff_select" on public.consultas
  for select using (public.is_staff() and public.can_access_patient(paciente_id));
create policy "consultas_doctor_insert" on public.consultas
  for insert with check (public.is_staff() and doctor_id = auth.uid());
create policy "consultas_staff_update" on public.consultas
  for update using (public.is_staff() and public.can_access_patient(paciente_id))
  with check (public.is_staff() and public.can_access_patient(paciente_id));

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
  for update using (public.is_staff() and doctor_id = auth.uid())
  with check (public.is_staff() and doctor_id = auth.uid());

-- Realtime additions are guarded so this migration is safe to rerun.
do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and c.relname = 'referral_requests'
  ) then
    alter publication supabase_realtime add table public.referral_requests;
  end if;
end $$;
