-- Consultorio San Juan
-- Migration 004: treatment service plans and monthly payment control
-- Run after 003_solicitudes_de_acceso.sql.

create table if not exists public.servicio_planes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  consulta_id uuid references public.consultas(id) on delete set null,
  creado_por uuid references public.profiles(id),
  creado_por_nombre text,
  concepto text not null,
  total_amount numeric(12,2) not null check (total_amount > 0),
  total_months integer not null check (total_months > 0),
  monthly_amount numeric(12,2) not null check (monthly_amount > 0),
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.servicio_pagos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.servicio_planes(id) on delete cascade,
  installment_number integer not null,
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  unique (plan_id, installment_number)
);

alter table public.servicio_planes enable row level security;
alter table public.servicio_pagos enable row level security;

drop policy if exists "servicio_planes_staff_all" on public.servicio_planes;
create policy "servicio_planes_staff_all" on public.servicio_planes
  for all using (public.is_staff() and public.can_access_patient(paciente_id))
  with check (public.is_staff() and public.can_access_patient(paciente_id));

drop policy if exists "servicio_pagos_staff_all" on public.servicio_pagos;
create policy "servicio_pagos_staff_all" on public.servicio_pagos
  for all using (
    public.is_staff() and exists (
      select 1 from public.servicio_planes plan
      where plan.id = plan_id and public.can_access_patient(plan.paciente_id)
    )
  ) with check (
    public.is_staff() and exists (
      select 1 from public.servicio_planes plan
      where plan.id = plan_id and public.can_access_patient(plan.paciente_id)
    )
  );

do $$
begin
  if not exists (select 1 from pg_publication_rel pr join pg_class c on c.oid = pr.prrelid join pg_publication p on p.oid = pr.prpubid where p.pubname = 'supabase_realtime' and c.relname = 'servicio_planes') then
    alter publication supabase_realtime add table public.servicio_planes;
  end if;
  if not exists (select 1 from pg_publication_rel pr join pg_class c on c.oid = pr.prrelid join pg_publication p on p.oid = pr.prpubid where p.pubname = 'supabase_realtime' and c.relname = 'servicio_pagos') then
    alter publication supabase_realtime add table public.servicio_pagos;
  end if;
end $$;