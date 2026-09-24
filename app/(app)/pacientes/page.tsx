"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Paciente, Profile } from "@/lib/types";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PacientesPage() {
  const supabase = createClient();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    fecha_nacimiento: "",
    sexo: "F",
    telefono: "",
    domicilio: "",
    alergias: "",
    antecedentes_hf: "",
    antecedentes_pp: "",
    antecedentes_pnp: "",
  });

  async function load() {
    const { data } = await supabase.from("pacientes").select("*").order("nombre");
    setPacientes((data as Paciente[]) || []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("pacientes-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "pacientes" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearPaciente(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("pacientes").insert({
      ...form,
      fecha_nacimiento: form.fecha_nacimiento || null,
      creado_por: userData.user?.id,
    });
    setSaving(false);
    setForm({
      nombre: "",
      fecha_nacimiento: "",
      sexo: "F",
      telefono: "",
      domicilio: "",
      alergias: "",
      antecedentes_hf: "",
      antecedentes_pp: "",
      antecedentes_pnp: "",
    });
  }

  const filtered = pacientes.filter((p) => p.nombre.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Expedientes</p>
          <h2 className="font-serif text-3xl text-slate-800">Pacientes</h2>
        </div>
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm text-cyan-800">
          {pacientes.length} registrados
        </span>
      </header>

      <div className="card">
        <div className="mb-5">
          <h3 className="text-lg font-bold text-slate-800">Nuevo paciente</h3>
          <p className="mt-1 text-sm text-slate-500">Datos generales del expediente clínico.</p>
        </div>
        <form onSubmit={crearPaciente} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="field">
              <label>Nombre completo</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="field">
              <label>Fecha de nacimiento</label>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="field">
              <label>Sexo</label>
              <select value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })}>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="field">
              <label>Domicilio</label>
              <input value={form.domicilio} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Alergias</label>
            <input
              value={form.alergias}
              onChange={(e) => setForm({ ...form, alergias: e.target.value })}
              placeholder="Penicilina, ninguna conocida, etc."
            />
          </div>
          <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">Antecedentes (NOM-004)</legend>
            <div className="field">
              <label>Heredofamiliares</label>
              <textarea
                value={form.antecedentes_hf}
                onChange={(e) => setForm({ ...form, antecedentes_hf: e.target.value })}
                placeholder="Diabetes, hipertensión en familiares, etc."
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="field">
                <label>Personales patológicos</label>
                <textarea
                  value={form.antecedentes_pp}
                  onChange={(e) => setForm({ ...form, antecedentes_pp: e.target.value })}
                  placeholder="Cirugías, enfermedades previas…"
                />
              </div>
              <div className="field">
                <label>Personales no patológicos</label>
                <textarea
                  value={form.antecedentes_pnp}
                  onChange={(e) => setForm({ ...form, antecedentes_pnp: e.target.value })}
                  placeholder="Hábitos, alimentación, ejercicio…"
                />
              </div>
            </div>
          </fieldset>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Crear expediente"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-bold text-slate-800">Pacientes registrados</h3>
          <span className="text-sm text-slate-500">Busca por nombre</span>
        </div>
        <input
          className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
          placeholder="Buscar por nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtered.length ? (
          <div className="space-y-3">
            {filtered.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-sm font-bold text-cyan-700">
                  {p.nombre.slice(0, 2).toUpperCase()}
                </div>
                <div>
                <p className="font-semibold text-slate-700">{p.nombre}</p>
                <p className="text-xs text-slate-500">
                  {p.sexo || "—"} · {p.telefono || "sin teléfono"} · Nac. {fmtDate(p.fecha_nacimiento)}
                </p>
                </div>
              </div>
              <Link href={`/pacientes/${p.id}`} className="btn-secondary">
                Abrir expediente
              </Link>
            </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500 border border-dashed border-[var(--line)] rounded-lg p-4 text-center">
            No hay pacientes registrados aún.
          </p>
        )}
      </div>
    </div>
  );
}
