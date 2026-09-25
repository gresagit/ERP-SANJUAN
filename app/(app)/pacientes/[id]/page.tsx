"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL, type Consulta, type Paciente, type Profile, type Receta, type ServicioPago, type ServicioPlan } from "@/lib/types";
import { descargarPlanServicio, descargarPlanTratamiento, descargarRecetaMedica, descargarResumenExpediente } from "@/lib/pdf";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

const AREAS = ["Nutrición", "Fisioterapia", "Enfermería", "Medicina general", "Otra"];

function isClinical(profile: Profile | null) {
  return profile?.rol === "doctor" || profile?.rol === "admin";
}

function roleMatchesArea(role: Profile["rol"], selectedArea: string) {
  if (selectedArea === "Nutrición") return role === "nutriologo";
  if (selectedArea === "Fisioterapia") return role === "fisioterapeuta";
  if (selectedArea === "Enfermería") return role === "enfermera";
  if (selectedArea === "Medicina general") return role === "doctor" || role === "admin";
  return true;
}

function addMonths(value: string, months: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export default function ExpedientePage() {
  const params = useParams();
  const pacienteId = params.id as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [planes, setPlanes] = useState<ServicioPlan[]>([]);
  const [pagos, setPagos] = useState<Record<string, ServicioPago[]>>({});
  const [staff, setStaff] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);

  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [exploracion, setExploracion] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [tratamiento, setTratamiento] = useState("");
  const [requiereEnfermera, setRequiereEnfermera] = useState(false);
  const [area, setArea] = useState("");
  const [profesionalCanaliza, setProfesionalCanaliza] = useState("");
  const [motivoCanaliza, setMotivoCanaliza] = useState("");
  const [receta, setReceta] = useState({ diagnostico: "", tratamiento: "", medicamento: "", dosis: "", frecuencia: "", duracion: "", indicaciones: "" });
  const [savingReceta, setSavingReceta] = useState(false);
  const [showCobro, setShowCobro] = useState(false);
  const [savingCobro, setSavingCobro] = useState(false);
  const [cobro, setCobro] = useState({ concepto: "", total: "", meses: "1", fechaInicio: todayISO(), consultaId: "" });

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
      setProfile(prof as Profile);
    }
    const { data: pac } = await supabase.from("pacientes").select("*").eq("id", pacienteId).single();
    setPaciente(pac as Paciente);

    const { data: cons } = await supabase
      .from("consultas")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("fecha", { ascending: false });
    setConsultas((cons as Consulta[]) || []);

    const { data: recetasData } = await supabase
      .from("recetas")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    setRecetas((recetasData as Receta[]) || []);

    const { data: planesData } = await supabase
      .from("servicio_planes")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false });
    const loadedPlans = (planesData as ServicioPlan[]) || [];
    setPlanes(loadedPlans);
    if (loadedPlans.length) {
      const { data: pagosData } = await supabase.from("servicio_pagos").select("*").in("plan_id", loadedPlans.map((plan) => plan.id)).order("installment_number");
      const grouped = ((pagosData as ServicioPago[]) || []).reduce<Record<string, ServicioPago[]>>((result, pago) => {
        result[pago.plan_id] = [...(result[pago.plan_id] || []), pago];
        return result;
      }, {});
      setPagos(grouped);
    } else {
      setPagos({});
    }

    const { data: allStaff } = await supabase.from("profiles").select("*").order("nombre");
    setStaff((allStaff as Profile[]) || []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("expediente-" + pacienteId)
      .on("postgres_changes", { event: "*", schema: "public", table: "consultas", filter: `paciente_id=eq.${pacienteId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "recetas", filter: `paciente_id=eq.${pacienteId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "servicio_planes", filter: `paciente_id=eq.${pacienteId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  async function guardarConsulta(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !paciente) return;
    setSaving(true);
    if (area && !profesionalCanaliza) {
      setSaving(false);
      alert("Selecciona al especialista que recibirá la canalización.");
      return;
    }
    const profCan = staff.find((p) => p.id === profesionalCanaliza);
    const { data: consulta, error } = await supabase.from("consultas").insert({
      paciente_id: pacienteId,
      doctor_id: profile.id,
      doctor_nombre: profile.nombre,
      fecha,
      motivo,
      exploracion,
      diagnostico,
      tratamiento,
      requiere_enfermera: requiereEnfermera,
      enfermeria_estado: requiereEnfermera ? "pendiente" : null,
      canaliza_area: area || null,
      canaliza_profesional_id: profesionalCanaliza || null,
      canaliza_profesional_nombre: profCan?.nombre || null,
      canaliza_motivo: motivoCanaliza || null,
      canaliza_estado: area ? "pendiente" : null,
    }).select("id").single();
    if (error || !consulta) {
      setSaving(false);
      alert("No se pudo guardar la nota. Revisa que la tabla de consultas esté configurada.");
      return;
    }
    if (area && profCan) {
      const { error: referralError } = await supabase.from("referral_requests").insert({
        paciente_id: pacienteId,
        paciente_nombre: paciente.nombre,
        consulta_id: consulta.id,
        sender_id: profile.id,
        sender_nombre: profile.nombre,
        recipient_id: profCan.id,
        recipient_nombre: profCan.nombre,
        area,
        motivo: motivoCanaliza,
        status: "pending",
      });
      if (referralError) alert("La nota se guardó, pero no se pudo crear la solicitud de canalización.");
    }
    setSaving(false);
    setMotivo("");
    setExploracion("");
    setDiagnostico("");
    setTratamiento("");
    setRequiereEnfermera(false);
    setArea("");
    setProfesionalCanaliza("");
    setMotivoCanaliza("");
  }

  async function guardarReceta(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingReceta(true);
    const { error } = await supabase.from("recetas").insert({
      paciente_id: pacienteId,
      doctor_id: profile.id,
      doctor_nombre: profile.nombre,
      ...receta,
    });
    if (error) {
      alert("No se pudo guardar la receta. Revisa que la tabla de recetas esté configurada.");
      setSavingReceta(false);
      return;
    }
    setReceta({ diagnostico: "", tratamiento: "", medicamento: "", dosis: "", frecuencia: "", duracion: "", indicaciones: "" });
    setSavingReceta(false);
    await load();
  }

  async function guardarCobro(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !paciente) return;
    const total = Number(cobro.total);
    const meses = Number(cobro.meses);
    if (!cobro.concepto.trim() || !Number.isFinite(total) || total <= 0 || !Number.isInteger(meses) || meses < 1) {
      alert("Captura un concepto, un costo total válido y al menos un mes.");
      return;
    }
    setSavingCobro(true);
    const mensualidad = Math.round((total / meses) * 100) / 100;
    const { data: plan, error } = await supabase.from("servicio_planes").insert({
      paciente_id: pacienteId,
      consulta_id: cobro.consultaId || null,
      creado_por: profile.id,
      creado_por_nombre: profile.nombre,
      concepto: cobro.concepto.trim(),
      total_amount: total,
      total_months: meses,
      monthly_amount: mensualidad,
      start_date: cobro.fechaInicio,
    }).select("*").single();
    if (error || !plan) {
      alert("No se pudo guardar el plan de cobro. Revisa que la migración 004 esté ejecutada.");
      setSavingCobro(false);
      return;
    }
    const cuotas = Array.from({ length: meses }, (_, index) => ({
      plan_id: plan.id,
      installment_number: index + 1,
      due_date: addMonths(cobro.fechaInicio, index),
      amount: index === meses - 1 ? Math.round((total - mensualidad * (meses - 1)) * 100) / 100 : mensualidad,
      status: "pending",
    }));
    const { error: pagosError } = await supabase.from("servicio_pagos").insert(cuotas);
    if (pagosError) alert("El plan se creó, pero no se pudieron crear todas sus mensualidades.");
    setCobro({ concepto: "", total: "", meses: "1", fechaInicio: todayISO(), consultaId: "" });
    setShowCobro(false);
    setSavingCobro(false);
    await load();
  }

  async function marcarPago(pago: ServicioPago) {
    const nextStatus = pago.status === "paid" ? "pending" : "paid";
    await supabase.from("servicio_pagos").update({ status: nextStatus, paid_at: nextStatus === "paid" ? new Date().toISOString() : null }).eq("id", pago.id);
    await load();
  }

  if (!paciente) return <p className="text-sm text-neutral-600">Cargando expediente…</p>;

  return (
    <>
      <Link href="/pacientes" className="text-teal-700 underline text-sm font-semibold mb-3 inline-block">
        ← Volver a pacientes
      </Link>

      <div className="card">
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h2 className="font-serif text-xl">{paciente.nombre}</h2>
            <p className="text-xs text-neutral-600">
              {paciente.sexo || "—"} · Nac. {fmtDate(paciente.fecha_nacimiento)} · Tel. {paciente.telefono || "—"} · Alergias:{" "}
              {paciente.alergias || "ninguna registrada"}
            </p>
          </div>
          <button className="btn-secondary" onClick={() => descargarResumenExpediente(paciente, consultas)}>
            Descargar resumen (PDF)
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-neutral-600">Antecedentes heredofamiliares</p>
            <p className="text-neutral-700">{paciente.antecedentes_hf || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-600">Antecedentes personales</p>
            <p className="text-neutral-700">
              Patológicos: {paciente.antecedentes_pp || "—"}
              <br />
              No patológicos: {paciente.antecedentes_pnp || "—"}
            </p>
          </div>
        </div>
      </div>

      {isClinical(profile) ? (
        <div className="card">
          <h2 className="font-serif text-xl">Nueva nota de evolución</h2>
          <form onSubmit={guardarConsulta} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="field">
                <label>Motivo de consulta</label>
                <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              <div className="field">
                <label>Fecha</label>
                <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Exploración física / hallazgos</label>
              <textarea value={exploracion} onChange={(e) => setExploracion(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="field">
                <label>Diagnóstico</label>
                <textarea required value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} />
              </div>
              <div className="field">
                <label>Plan de tratamiento</label>
                <textarea required value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} />
              </div>
            </div>
            <fieldset className="border border-[var(--line)] rounded-lg p-3">
              <legend className="text-xs font-bold text-teal-700 px-1">Enfermería</legend>
              <label className="flex items-center gap-2 text-sm font-normal">
                <input
                  type="checkbox"
                  className="w-auto"
                  checked={requiereEnfermera}
                  onChange={(e) => setRequiereEnfermera(e.target.checked)}
                />
                Este tratamiento requiere seguimiento de enfermería
              </label>
            </fieldset>
            <fieldset className="border border-[var(--line)] rounded-lg p-3">
              <legend className="text-xs font-bold text-teal-700 px-1">Canalizar a otra área de salud (opcional)</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="field">
                  <label>Área</label>
                  <select value={area} onChange={(e) => setArea(e.target.value)}>
                    <option value="">— No canalizar —</option>
                    {AREAS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Profesional</label>
                  <select value={profesionalCanaliza} onChange={(e) => setProfesionalCanaliza(e.target.value)}>
                    <option value="">Cualquiera del área</option>
                    {staff
                      .filter((p) => p.id !== profile?.id && roleMatchesArea(p.rol, area))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({ROLE_LABEL[p.rol]})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Motivo de la canalización</label>
                <input
                  value={motivoCanaliza}
                  onChange={(e) => setMotivoCanaliza(e.target.value)}
                  placeholder="Ej. valoración nutricional por sobrepeso"
                />
              </div>
            </fieldset>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar nota"}
            </button>
          </form>
        </div>
      ) : (
        <div className="card">
          <p className="text-sm text-neutral-600 m-0">
            Solo el personal médico puede agregar nuevas notas de evolución. Puedes consultar el historial abajo.
          </p>
        </div>
      )}

      {isClinical(profile) && (
        <div className="card">
          <div className="mb-5">
            <h2 className="font-serif text-xl text-slate-800">Nueva receta médica</h2>
            <p className="mt-1 text-sm text-slate-500">Agrega cada indicación al expediente del paciente.</p>
          </div>
          <form onSubmit={guardarReceta} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="field"><label>Diagnóstico</label><textarea required value={receta.diagnostico} onChange={(e) => setReceta({ ...receta, diagnostico: e.target.value })} placeholder="Diagnóstico que sustenta la receta" /></div>
              <div className="field"><label>Tratamiento</label><textarea required value={receta.tratamiento} onChange={(e) => setReceta({ ...receta, tratamiento: e.target.value })} placeholder="Objetivo y plan de tratamiento" /></div>
              <div className="field"><label>Medicamento</label><input required value={receta.medicamento} onChange={(e) => setReceta({ ...receta, medicamento: e.target.value })} placeholder="Nombre y presentación" /></div>
              <div className="field"><label>Dosis</label><input required value={receta.dosis} onChange={(e) => setReceta({ ...receta, dosis: e.target.value })} placeholder="Ej. 500 mg" /></div>
              <div className="field"><label>Frecuencia</label><input required value={receta.frecuencia} onChange={(e) => setReceta({ ...receta, frecuencia: e.target.value })} placeholder="Ej. cada 8 horas" /></div>
              <div className="field"><label>Duración</label><input required value={receta.duracion} onChange={(e) => setReceta({ ...receta, duracion: e.target.value })} placeholder="Ej. 7 días" /></div>
            </div>
            <div className="field"><label>Indicaciones adicionales</label><textarea value={receta.indicaciones} onChange={(e) => setReceta({ ...receta, indicaciones: e.target.value })} placeholder="Tomar después de alimentos, reposo, señales de alarma…" /></div>
            <button className="btn" type="submit" disabled={savingReceta}>{savingReceta ? "Guardando…" : "Guardar receta"}</button>
          </form>
        </div>
      )}

      <div className="card border-emerald-200 bg-emerald-50/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-serif text-xl text-slate-800">Cobro de servicio</h2><p className="mt-1 text-sm text-slate-500">Relaciona el tratamiento con un plan total y sus mensualidades.</p></div>
          <button className="btn-secondary" type="button" onClick={() => setShowCobro((visible) => !visible)}>{showCobro ? "Cerrar formulario" : "+ Nuevo cobro"}</button>
        </div>
        {showCobro && <form onSubmit={guardarCobro} className="mt-5 space-y-4"><div className="field"><label>Concepto del servicio</label><input required value={cobro.concepto} onChange={(e) => setCobro({ ...cobro, concepto: e.target.value })} placeholder="Tratamiento de rehabilitación, plan nutricional…" /></div><div className="grid gap-4 md:grid-cols-3"><div className="field"><label>Costo total</label><input required type="number" min="0.01" step="0.01" value={cobro.total} onChange={(e) => setCobro({ ...cobro, total: e.target.value })} placeholder="10000" /></div><div className="field"><label>Meses</label><input required type="number" min="1" step="1" value={cobro.meses} onChange={(e) => setCobro({ ...cobro, meses: e.target.value })} /></div><div className="field"><label>Inicio del plan</label><input required type="date" value={cobro.fechaInicio} onChange={(e) => setCobro({ ...cobro, fechaInicio: e.target.value })} /></div></div><div className="field"><label>Plan de tratamiento relacionado</label><select value={cobro.consultaId} onChange={(e) => setCobro({ ...cobro, consultaId: e.target.value })}><option value="">Seleccionar consulta (opcional)</option>{consultas.map((consulta) => <option key={consulta.id} value={consulta.id}>{fmtDate(consulta.fecha)} · {consulta.diagnostico || consulta.motivo || "Consulta"}</option>)}</select></div><p className="rounded-xl bg-white px-3 py-2 text-sm text-emerald-800">Mensualidad estimada: <strong>{Number(cobro.total) > 0 && Number(cobro.meses) > 0 ? `$${(Number(cobro.total) / Number(cobro.meses)).toFixed(2)}` : "$0.00"}</strong></p><button className="btn" type="submit" disabled={savingCobro}>{savingCobro ? "Generando plan…" : "Guardar plan de cobro"}</button></form>}
        {planes.length > 0 && <div className="mt-5 space-y-4">{planes.map((plan) => <article key={plan.id} className="rounded-2xl border border-emerald-200 bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold text-slate-800">{plan.concepto}</p><p className="text-sm text-slate-600">{plan.total_months} meses · {plan.monthly_amount.toLocaleString("es-MX", { style: "currency", currency: "MXN" })} al mes · Total {plan.total_amount.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</p><p className="text-xs text-slate-500">Inicio: {fmtDate(plan.start_date)} · Creado por {plan.creado_por_nombre || "—"}</p></div><button className="btn-secondary" onClick={() => descargarPlanServicio(paciente, plan, pagos[plan.id] || [])}>Imprimir plan PDF</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(pagos[plan.id] || []).map((pago) => <button key={pago.id} type="button" onClick={() => marcarPago(pago)} className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${pago.status === "paid" ? "border-emerald-300 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Mensualidad {pago.installment_number}</p><p className="mt-1 font-bold text-slate-800">{Number(pago.amount).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</p><p className="text-xs text-slate-600">{fmtDate(pago.due_date)} · {pago.status === "paid" ? "Pagada" : "Pendiente"}</p></button>)}</div><p className="mt-3 text-xs text-slate-500">Haz clic en una mensualidad para cambiarla entre pendiente y pagada.</p></article>)}</div>}
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="font-serif text-xl text-slate-800">Recetas médicas</h2><p className="mt-1 text-sm text-slate-500">Historial de indicaciones prescritas.</p></div>
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">{recetas.length} recetas</span>
        </div>
        {recetas.length ? <div className="space-y-3">{recetas.map((r) => <article key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold text-slate-800">{r.medicamento}</p><p className="text-sm text-slate-600">{r.dosis} · {r.frecuencia} · {r.duracion}</p><p className="mt-2 text-sm text-slate-600"><strong>Diagnóstico:</strong> {r.diagnostico || "—"}</p><p className="text-sm text-slate-600"><strong>Tratamiento:</strong> {r.tratamiento || "—"}</p></div><div className="flex shrink-0 flex-col items-start gap-2 sm:items-end"><p className="text-xs text-slate-500">{fmtDate(r.fecha)} · {r.doctor_nombre || "Médico"}</p><button className="btn-secondary" onClick={() => descargarRecetaMedica(paciente, r)}>Descargar receta</button></div></div>{r.indicaciones && <p className="mt-2 text-sm text-slate-600"><strong>Indicaciones:</strong> {r.indicaciones}</p>}</article>)}</div> : <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">Sin recetas registradas todavía.</p>}
      </div>

      <div className="card">
        <h2 className="font-serif text-xl mb-3">Historial de consultas</h2>
        {consultas.length ? (
          consultas.map((c) => (
            <div key={c.id} className="border border-[var(--line)] rounded-lg p-3 mb-2">
              <div className="flex justify-between items-start gap-2 flex-wrap">
                <div>
                  <p className="font-semibold">
                    {fmtDate(c.fecha)} · {c.doctor_nombre}
                  </p>
                  <p className="text-xs text-neutral-600">Motivo: {c.motivo}</p>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {c.requiere_enfermera && (
                    <span className={`pill ${c.enfermeria_estado === "completado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      Enfermería {c.enfermeria_estado === "completado" ? "atendida" : "pendiente"}
                    </span>
                  )}
                  {c.canaliza_area && <span className="pill bg-[#e4e9d8] text-[#5a6b2e]">→ {c.canaliza_area}</span>}
                  <button
                    className="text-teal-700 underline text-xs font-semibold"
                    onClick={() => descargarPlanTratamiento(paciente, c)}
                  >
                    Plan en PDF
                  </button>
                </div>
              </div>
              {c.exploracion && (
                <p className="text-sm text-neutral-700 mt-1">
                  <strong>Exploración:</strong> {c.exploracion}
                </p>
              )}
              <p className="text-sm text-neutral-700">
                <strong>Diagnóstico:</strong> {c.diagnostico}
              </p>
              <p className="text-sm text-neutral-700">
                <strong>Tratamiento:</strong> {c.tratamiento}
              </p>
              {c.canaliza_area && (
                <p className="text-sm text-neutral-700">
                  <strong>Canalizado a:</strong> {c.canaliza_area}
                  {c.canaliza_profesional_nombre ? " — " + c.canaliza_profesional_nombre : ""}. Motivo: {c.canaliza_motivo || "—"}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-neutral-500 border border-dashed border-[var(--line)] rounded-lg p-4 text-center">
            Sin consultas registradas todavía.
          </p>
        )}
      </div>
    </>
  );
}
