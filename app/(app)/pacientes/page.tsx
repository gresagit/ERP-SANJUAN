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
    <>
      <div className="card">
        <h2 className="font-serif text-xl">Nuevo paciente</h2>
        <p className="text-sm text-neutral-600 mb-4">Datos generales del expediente clínico.</p>
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
          <fieldset className="border border-[var(--line)] rounded-lg p-3">
            <legend className="text-xs font-bold text-teal-700 px-1">Antecedentes (NOM-004)</legend>
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
        <h2 className="font-serif text-xl mb-3">Pacientes registrados</h2>
        <input
          className="mb-3 w-full rounded-lg border border-[var(--line)] bg-sand-100 px-3 py-2 text-sm"
          placeholder="Buscar por nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtered.length ? (
          filtered.map((p) => (
            <div key={p.id} className="border border-[var(--line)] rounded-lg p-3 mb-2 flex justify-between items-start gap-2 flex-wrap">
              <div>
                <p className="font-semibold">{p.nombre}</p>
                <p className="text-xs text-neutral-600">
                  {p.sexo || "—"} · {p.telefono || "sin teléfono"} · Nac. {fmtDate(p.fecha_nacimiento)}
                </p>
              </div>
              <Link href={`/pacientes/${p.id}`} className="btn-secondary">
                Abrir expediente
              </Link>
            </div>
          ))
        ) : (
          <p className="text-sm text-neutral-500 border border-dashed border-[var(--line)] rounded-lg p-4 text-center">
            No hay pacientes registrados aún.
          </p>
        )}
      </div>
    </>
  );
}
