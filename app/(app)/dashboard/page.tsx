"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Cita, Consulta, Profile } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" });
}

export default function DashboardPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [citasHoy, setCitasHoy] = useState<Cita[]>([]);
  const [canalizados, setCanalizados] = useState<(Consulta & { paciente_nombre?: string })[]>([]);
  const [tareasEnfermeria, setTareasEnfermeria] = useState<(Consulta & { paciente_nombre?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
    setProfile(prof as Profile);
    if (!prof) return;

    const { data: citas } = await supabase
      .from("citas")
      .select("*")
      .eq("profesional_id", userData.user.id)
      .eq("fecha", todayISO())
      .order("hora", { ascending: true });
    setCitasHoy((citas as Cita[]) || []);

    const { data: canal } = await supabase
      .from("consultas")
      .select("*, pacientes(nombre)")
      .eq("canaliza_profesional_id", userData.user.id)
      .neq("canaliza_estado", "atendido");
    setCanalizados(
      ((canal as any[]) || []).map((c) => ({ ...c, paciente_nombre: c.pacientes?.nombre }))
    );

    if ((prof as Profile).rol === "enfermera") {
      const { data: tareas } = await supabase
        .from("consultas")
        .select("*, pacientes(nombre)")
        .eq("requiere_enfermera", true)
        .neq("enfermeria_estado", "completado");
      setTareasEnfermeria(
        ((tareas as any[]) || []).map((c) => ({ ...c, paciente_nombre: c.pacientes?.nombre }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "citas" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "consultas" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function marcarTareaHecha(consultaId: string) {
    if (!profile) return;
    await supabase
      .from("consultas")
      .update({ enfermeria_estado: "completado", enfermera_id: profile.id })
      .eq("id", consultaId);
  }

  if (loading || !profile) return <p className="text-sm text-slate-600">Cargando…</p>;

  const stats = [
    { label: "Citas hoy", value: String(citasHoy.length), accent: "from-cyan-500 to-sky-600" },
    { label: "Canalizaciones", value: String(canalizados.length), accent: "from-violet-500 to-indigo-600" },
    { label: "Tareas enfermería", value: String(tareasEnfermeria.length), accent: "from-amber-400 to-orange-500" },
    { label: "Rol", value: profile.rol, accent: "from-emerald-500 to-teal-600" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-900 p-6 text-white shadow-lg shadow-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Panel principal</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-white">Hola, {profile.nombre.split(" ")[0]}</h2>
          </div>
          <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
            {fmtDate(todayISO())}
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card overflow-hidden p-0">
            <div className={`h-1 w-full bg-gradient-to-r ${stat.accent}`} />
            <div className="p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Tu agenda de hoy</h3>
            <Link href="/agenda" className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
              Ver agenda
            </Link>
          </div>

          {citasHoy.length ? (
            <div className="space-y-3">
              {citasHoy.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {c.hora?.slice(0, 5)} · {c.paciente_nombre}
                    </p>
                    <p className="text-xs text-slate-500">{c.motivo || "Consulta general"}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${c.estado === "completada" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {c.estado === "completada" ? "Atendida" : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No tienes citas agendadas para hoy.
            </p>
          )}
        </div>

        <div className="card">
          <h3 className="mb-4 text-lg font-bold text-slate-800">Acciones rápidas</h3>
          <div className="space-y-3">
            <Link href="/agenda" className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-cyan-200 hover:bg-cyan-50">
              <div>
                <p className="font-semibold text-slate-700">Nueva cita</p>
                <p className="text-xs text-slate-500">Agendar paciente</p>
              </div>
              <span className="rounded-full bg-cyan-100 p-2 text-cyan-700">→</span>
            </Link>
            <Link href="/pacientes" className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-cyan-200 hover:bg-cyan-50">
              <div>
                <p className="font-semibold text-slate-700">Nuevo expediente</p>
                <p className="text-xs text-slate-500">Registrar paciente</p>
              </div>
              <span className="rounded-full bg-emerald-100 p-2 text-emerald-700">→</span>
            </Link>
            <Link href="/farmacia" className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-cyan-200 hover:bg-cyan-50">
              <div>
                <p className="font-semibold text-slate-700">Farmacia</p>
                <p className="text-xs text-slate-500">Ver medicamentos</p>
              </div>
              <span className="rounded-full bg-violet-100 p-2 text-violet-700">→</span>
            </Link>
          </div>
        </div>
      </section>

      {canalizados.length > 0 && (
        <section className="card">
          <h3 className="mb-4 text-lg font-bold text-slate-800">Pacientes canalizados hacia ti</h3>
          <div className="space-y-3">
            {canalizados.map((c) => (
              <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-700">{c.paciente_nombre}</p>
                  <p className="text-xs text-slate-500">Área: {c.canaliza_area} · Referido por {c.doctor_nombre}</p>
                  <p className="text-xs text-slate-500">Motivo: {c.canaliza_motivo || "—"}</p>
                </div>
                <Link href={`/pacientes/${c.paciente_id}`} className="btn btn-secondary">
                  Ver expediente
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.rol === "enfermera" && (
        <section className="card">
          <h3 className="mb-4 text-lg font-bold text-slate-800">Tareas de enfermería pendientes</h3>
          {tareasEnfermeria.length ? (
            <div className="space-y-3">
              {tareasEnfermeria.map((c) => (
                <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-700">{c.paciente_nombre}</p>
                    <p className="text-xs text-slate-500">Indicado por {c.doctor_nombre}</p>
                    <p className="text-xs text-slate-500">{c.tratamiento}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/pacientes/${c.paciente_id}`} className="btn btn-secondary">
                      Ver
                    </Link>
                    <button className="btn" onClick={() => marcarTareaHecha(c.id)}>
                      Marcar hecho
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No tienes tareas de enfermería pendientes.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
