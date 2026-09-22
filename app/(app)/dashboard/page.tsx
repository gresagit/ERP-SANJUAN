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

  if (loading || !profile) return <p className="text-sm text-neutral-600">Cargando…</p>;

  return (
    <div className="card">
      <h2 className="font-serif text-xl">Hola, {profile.nombre.split(" ")[0]}</h2>
      <p className="text-sm text-neutral-600 mb-4 capitalize">{fmtDate(todayISO())}</p>

      <h3 className="text-sm font-bold text-teal-700 mt-4 mb-2">Tu agenda de hoy</h3>
      {citasHoy.length ? (
        citasHoy.map((c) => (
          <div key={c.id} className="border border-[var(--line)] rounded-lg p-3 mb-2 flex justify-between items-start gap-2 flex-wrap">
            <div>
              <p className="font-semibold">
                {c.hora?.slice(0, 5)} · {c.paciente_nombre}
              </p>
              <p className="text-xs text-neutral-600">{c.motivo || "Consulta general"}</p>
            </div>
            <span className={`pill ${c.estado === "completada" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {c.estado === "completada" ? "Atendida" : "Pendiente"}
            </span>
          </div>
        ))
      ) : (
        <p className="text-sm text-neutral-500 border border-dashed border-[var(--line)] rounded-lg p-4 text-center">
          No tienes citas agendadas para hoy.
        </p>
      )}

      {canalizados.length > 0 && (
        <>
          <h3 className="text-sm font-bold text-ochre-600 mt-6 mb-2">Pacientes canalizados hacia ti</h3>
          {canalizados.map((c) => (
            <div key={c.id} className="border border-[var(--line)] rounded-lg p-3 mb-2 flex justify-between items-start gap-2 flex-wrap">
              <div>
                <p className="font-semibold">{c.paciente_nombre}</p>
                <p className="text-xs text-neutral-600">
                  Área: {c.canaliza_area} · Referido por {c.doctor_nombre}
                </p>
                <p className="text-xs text-neutral-600">Motivo: {c.canaliza_motivo || "—"}</p>
              </div>
              <Link href={`/pacientes/${c.paciente_id}`} className="btn-secondary">
                Ver expediente
              </Link>
            </div>
          ))}
        </>
      )}

      {profile.rol === "enfermera" && (
        <>
          <h3 className="text-sm font-bold text-ochre-600 mt-6 mb-2">Tareas de enfermería pendientes</h3>
          {tareasEnfermeria.length ? (
            tareasEnfermeria.map((c) => (
              <div key={c.id} className="border border-[var(--line)] rounded-lg p-3 mb-2 flex justify-between items-start gap-2 flex-wrap">
                <div>
                  <p className="font-semibold">{c.paciente_nombre}</p>
                  <p className="text-xs text-neutral-600">Indicado por {c.doctor_nombre}</p>
                  <p className="text-xs text-neutral-600">{c.tratamiento}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/pacientes/${c.paciente_id}`} className="btn-secondary">
                    Ver
                  </Link>
                  <button className="btn" onClick={() => marcarTareaHecha(c.id)}>
                    Marcar hecho
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-neutral-500 border border-dashed border-[var(--line)] rounded-lg p-4 text-center">
              No tienes tareas de enfermería pendientes.
            </p>
          )}
        </>
      )}
    </div>
  );
}
