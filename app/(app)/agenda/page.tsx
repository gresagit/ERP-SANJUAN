"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Cita, Paciente, Profile } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowHM() {
  return new Date().toTimeString().slice(0, 5);
}
function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AgendaPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);

  const [profesionalId, setProfesionalId] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [hora, setHora] = useState(nowHM());
  const [pacienteNombre, setPacienteNombre] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
    setProfile(prof as Profile);
    if (prof) setProfesionalId((prof as Profile).id);

    const { data: allStaff } = await supabase
      .from("profiles")
      .select("*")
      .in("rol", ["doctor", "enfermera"])
      .order("nombre");
    setStaff((allStaff as Profile[]) || []);

    const { data: pacs } = await supabase.from("pacientes").select("*").order("nombre");
    setPacientes((pacs as Paciente[]) || []);

    if (prof) {
      const { data: citasData } = await supabase
        .from("citas")
        .select("*")
        .eq("profesional_id", (prof as Profile).id)
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true });
      setCitas((citasData as Cita[]) || []);
    }
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("agenda-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "citas" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearCita(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const prof = staff.find((p) => p.id === profesionalId) || profile;
    const paciente = pacientes.find((p) => p.nombre.toLowerCase() === pacienteNombre.toLowerCase());
    await supabase.from("citas").insert({
      profesional_id: prof?.id,
      profesional_nombre: prof?.nombre,
      paciente_id: paciente?.id || null,
      paciente_nombre: pacienteNombre,
      fecha,
      hora,
      motivo,
      estado: "pendiente",
    });
    setSaving(false);
    setPacienteNombre("");
    setMotivo("");
  }

  async function marcarAtendida(id: string) {
    await supabase.from("citas").update({ estado: "completada" }).eq("id", id);
  }

  if (!profile) return <p className="text-sm text-neutral-600">Cargando…</p>;

  return (
    <>
      <div className="card">
        <h2 className="font-serif text-xl">Nueva cita</h2>
        <p className="text-sm text-neutral-600 mb-4">Agenda una cita para ti o para otro miembro del equipo.</p>
        <form onSubmit={crearCita} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="field">
              <label>Profesional</label>
              <select value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)}>
                {staff.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Fecha</label>
              <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="field">
              <label>Hora</label>
              <input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="field">
              <label>Paciente</label>
              <input
                list="dl-pacientes"
                required
                value={pacienteNombre}
                onChange={(e) => setPacienteNombre(e.target.value)}
                placeholder="Nombre del paciente"
              />
              <datalist id="dl-pacientes">
                {pacientes.map((p) => (
                  <option key={p.id} value={p.nombre} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label>Motivo</label>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Consulta general, control…" />
            </div>
          </div>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Agendando…" : "Agendar"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="font-serif text-xl mb-3">Tu agenda completa</h2>
        {citas.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-neutral-500 border-b-2 border-[var(--line)]">
                  <th className="py-2">Fecha</th>
                  <th>Hora</th>
                  <th>Paciente</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {citas.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--line)]">
                    <td className="py-2">{fmtDate(c.fecha)}</td>
                    <td>{c.hora?.slice(0, 5)}</td>
                    <td>{c.paciente_nombre}</td>
                    <td>{c.motivo || "—"}</td>
                    <td>
                      <span className={`pill ${c.estado === "completada" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {c.estado === "completada" ? "Atendida" : "Pendiente"}
                      </span>
                    </td>
                    <td>
                      {c.estado !== "completada" && (
                        <button className="text-teal-700 underline text-xs font-semibold" onClick={() => marcarAtendida(c.id)}>
                          Marcar atendida
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 border border-dashed border-[var(--line)] rounded-lg p-4 text-center">
            Sin citas registradas todavía.
          </p>
        )}
      </div>
    </>
  );
}
