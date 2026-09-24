"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Cita, Paciente, Profile } from "@/lib/types";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayISO() {
  return dateKey(new Date());
}

function nowHM() {
  return new Date().toTimeString().slice(0, 5);
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function firstOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function fmtMonth(date: Date) {
  return date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function initials(name: string | null) {
  return (name || "?").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

const PROFESSIONAL_COLORS = [
  "border-cyan-500 bg-cyan-50 text-cyan-900",
  "border-violet-500 bg-violet-50 text-violet-900",
  "border-emerald-500 bg-emerald-50 text-emerald-900",
  "border-amber-500 bg-amber-50 text-amber-900",
  "border-rose-500 bg-rose-50 text-rose-900",
  "border-blue-500 bg-blue-50 text-blue-900",
];

function statusLabel(status: string) {
  if (status === "completada") return "Atendida";
  if (status === "cancelada") return "Cancelada";
  return "Pendiente";
}

export default function AgendaPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [monthCursor, setMonthCursor] = useState(() => firstOfMonth(new Date()));
  const [selectedProfessional, setSelectedProfessional] = useState("all");
  const [selectedCita, setSelectedCita] = useState<Cita | null>(null);
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
    if (prof && !profesionalId) setProfesionalId((prof as Profile).id);
    const { data: allStaff } = await supabase.from("profiles").select("*").order("nombre");
    setStaff((allStaff as Profile[]) || []);
    const { data: pacs } = await supabase.from("pacientes").select("*").order("nombre");
    setPacientes((pacs as Paciente[]) || []);
    const { data: citasData } = await supabase.from("citas").select("*").order("fecha", { ascending: true }).order("hora", { ascending: true });
    setCitas((citasData as Cita[]) || []);
  }

  useEffect(() => {
    load();
    const channel = supabase.channel("agenda-changes").on("postgres_changes", { event: "*", schema: "public", table: "citas" }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleCitas = useMemo(() => citas.filter((cita) => selectedProfessional === "all" || cita.profesional_id === selectedProfessional), [citas, selectedProfessional]);
  const calendarDays = useMemo(() => {
    const firstDay = firstOfMonth(monthCursor);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => addDays(firstDay, index - mondayOffset));
  }, [monthCursor]);
  const monthCitas = useMemo(() => visibleCitas.filter((cita) => cita.fecha.startsWith(`${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`)), [monthCursor, visibleCitas]);

  function professionalColor(id: string | null) {
    const index = Math.max(0, staff.findIndex((person) => person.id === id));
    return PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length];
  }

  function selectDay(day: Date) {
    setFecha(dateKey(day));
    setHora("09:00");
    document.getElementById("new-appointment")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function crearCita(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const professional = staff.find((person) => person.id === profesionalId) || profile;
    const paciente = pacientes.find((person) => person.nombre.toLowerCase() === pacienteNombre.toLowerCase());
    const { error } = await supabase.from("citas").insert({ profesional_id: professional?.id, profesional_nombre: professional?.nombre, paciente_id: paciente?.id || null, paciente_nombre: pacienteNombre, fecha, hora, motivo, estado: "pendiente" });
    if (error) {
      alert("No se pudo guardar la cita. Revisa los datos e inténtalo de nuevo.");
      setSaving(false);
      return;
    }
    setMonthCursor(firstOfMonth(new Date(`${fecha}T12:00:00`)));
    setSaving(false);
    setPacienteNombre("");
    setMotivo("");
    await load();
  }

  async function marcarAtendida(id: string) {
    await supabase.from("citas").update({ estado: "completada" }).eq("id", id);
    setSelectedCita((current) => current?.id === id ? { ...current, estado: "completada" } : current);
    await load();
  }

  if (!profile) return <p className="text-sm text-slate-600">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Agenda compartida</p>
          <h2 className="font-serif text-3xl text-slate-800">Calendario consultorio</h2>
          <p className="mt-1 text-sm text-slate-500">Consulta y organiza las citas de todo el equipo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={() => setMonthCursor(firstOfMonth(new Date()))}>Este mes</button>
          <button className="btn-secondary px-3" aria-label="Mes anterior" onClick={() => setMonthCursor((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>←</button>
          <button className="btn-secondary px-3" aria-label="Mes siguiente" onClick={() => setMonthCursor((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>→</button>
        </div>
      </header>

      <section className="order-2 card space-y-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Agenda del equipo</h3>
            <p className="text-sm capitalize text-slate-500">{fmtMonth(monthCursor)} · {monthCitas.length} citas</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${selectedProfessional === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`} onClick={() => setSelectedProfessional("all")}>Todo el equipo</button>
            {staff.map((person) => <button key={person.id} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition ${selectedProfessional === person.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`} onClick={() => setSelectedProfessional(person.id)}><span className={`h-2.5 w-2.5 rounded-full border-2 ${professionalColor(person.id).split(" ")[0]}`} />{person.nombre}</button>)}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => <div key={day} className="p-3 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{day}</div>)}</div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayKey = dateKey(day);
                const inMonth = day.getMonth() === monthCursor.getMonth();
                const dayCitas = visibleCitas.filter((cita) => cita.fecha === dayKey);
                return <div key={dayKey} onClick={() => selectDay(day)} className={`min-h-[132px] border-b border-r border-slate-200 p-2 text-left transition hover:bg-cyan-50/60 ${inMonth ? "bg-white" : "bg-slate-50/70"}`}><div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${dayKey === todayISO() ? "bg-cyan-600 text-white" : inMonth ? "text-slate-700" : "text-slate-400"}`}>{day.getDate()}</div><div className="space-y-1">{dayCitas.map((cita) => <button key={cita.id} type="button" onClick={(event) => { event.stopPropagation(); setSelectedCita(cita); }} className={`block w-full truncate rounded-lg border-l-4 px-2 py-1 text-left text-[11px] font-semibold shadow-sm ${professionalColor(cita.profesional_id)} ${cita.estado === "cancelada" ? "opacity-50 line-through" : ""}`} title={`${cita.hora.slice(0, 5)} · ${cita.paciente_nombre}`}>{cita.hora.slice(0, 5)} · {cita.paciente_nombre}</button>)}</div></div>;
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-slate-500"><span>Colores: cada especialista tiene un color propio.</span><span className="ml-auto">Haz clic en un día para preparar una cita o en una cita para ver sus detalles.</span></div>
      </section>

      <div className="order-1 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section id="new-appointment" className="card scroll-mt-24">
          <h3 className="mb-1 text-lg font-bold text-slate-800">Nueva cita</h3>
          <p className="mb-5 text-sm text-slate-500">La cita será visible para todo el personal autorizado.</p>
          <form onSubmit={crearCita} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3"><div className="field"><label>Profesional</label><select value={profesionalId} onChange={(event) => setProfesionalId(event.target.value)}>{staff.map((person) => <option key={person.id} value={person.id}>{person.nombre}</option>)}</select></div><div className="field"><label>Fecha</label><input type="date" required value={fecha} onChange={(event) => setFecha(event.target.value)} /></div><div className="field"><label>Hora</label><input type="time" required value={hora} onChange={(event) => setHora(event.target.value)} /></div></div>
            <div className="grid gap-4 md:grid-cols-2"><div className="field"><label>Paciente</label><input list="dl-pacientes" required value={pacienteNombre} onChange={(event) => setPacienteNombre(event.target.value)} placeholder="Nombre del paciente" /><datalist id="dl-pacientes">{pacientes.map((patient) => <option key={patient.id} value={patient.nombre} />)}</datalist></div><div className="field"><label>Motivo</label><input value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Consulta general, control…" /></div></div>
            <button className="btn" type="submit" disabled={saving}>{saving ? "Agendando…" : "Agendar cita"}</button>
          </form>
        </section>

        <aside className="card"><h3 className="mb-4 text-lg font-bold text-slate-800">Resumen compartido</h3><div className="space-y-3"><div className="rounded-2xl bg-slate-100 p-3"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Este mes</p><p className="mt-2 text-2xl font-bold text-slate-800">{monthCitas.length}</p></div><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Atendidas</p><p className="mt-2 text-2xl font-bold text-emerald-700">{monthCitas.filter((cita) => cita.estado === "completada").length}</p></div><div className="rounded-2xl bg-amber-50 p-3"><p className="text-xs uppercase tracking-[0.18em] text-amber-700">Pendientes</p><p className="mt-2 text-2xl font-bold text-amber-700">{monthCitas.filter((cita) => cita.estado === "pendiente").length}</p></div></div><p className="mt-4 text-xs leading-5 text-slate-500">Todos los miembros con perfil pueden consultar y actualizar la agenda compartida.</p></aside>
      </div>

      {selectedCita && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Detalles de la cita" onClick={() => setSelectedCita(null)}>
          <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Detalle de cita</p><h3 className="mt-1 font-serif text-2xl text-slate-800">{selectedCita.paciente_nombre}</h3></div>
              <button type="button" className="btn-secondary px-3" onClick={() => setSelectedCita(null)} aria-label="Cerrar detalles">×</button>
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <p><strong className="text-slate-800">Fecha:</strong> {new Date(`${selectedCita.fecha}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
              <p><strong className="text-slate-800">Hora:</strong> {selectedCita.hora.slice(0, 5)}</p>
              <p><strong className="text-slate-800">Profesional:</strong> {selectedCita.profesional_nombre || "Sin asignar"}</p>
              <p><strong className="text-slate-800">Motivo:</strong> {selectedCita.motivo || "Consulta general"}</p>
              <p><strong className="text-slate-800">Estado:</strong> {selectedCita.estado === "completada" ? "Atendida" : selectedCita.estado === "cancelada" ? "Cancelada" : "Pendiente"}</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {selectedCita.paciente_id && <a className="btn-secondary" href={`/pacientes/${selectedCita.paciente_id}`}>Abrir expediente</a>}
              {selectedCita.estado !== "completada" && <button className="btn" type="button" onClick={() => marcarAtendida(selectedCita.id)}>Marcar atendida</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
