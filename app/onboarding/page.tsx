"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { StaffRole } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<StaffRole>("doctor");
  const [especialidad, setEspecialidad] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      router.push("/login");
      return;
    }
    const { error } = await supabase.from("profiles").insert({
      id: userData.user.id,
      nombre,
      rol,
      especialidad: especialidad || null,
    });
    setLoading(false);
    if (error) {
      setError("No se pudo guardar tu perfil: " + error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full">
        <h1 className="font-serif text-2xl text-teal-700 mb-1">Completa tu perfil</h1>
        <p className="text-sm text-neutral-600 mb-6">Así te identificaremos en la agenda y los expedientes.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label>Nombre completo</label>
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Dra. Ana Ruiz" />
          </div>
          <div className="field">
            <label>Rol</label>
            <select value={rol} onChange={(e) => setRol(e.target.value as StaffRole)}>
              <option value="doctor">Doctor(a)</option>
              <option value="enfermera">Enfermero(a)</option>
              <option value="fisioterapeuta">Fisioterapeuta</option>
              <option value="nutriologo">Nutriólogo(a)</option>
              <option value="farmacia">Farmacia</option>
              <option value="recepcion">Recepción</option>
            </select>
          </div>
          <div className="field">
            <label>Especialidad (opcional)</label>
            <input
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
              placeholder="Nutrición, Fisioterapia, General…"
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? "Guardando…" : "Entrar al sistema"}
          </button>
        </form>
      </div>
    </div>
  );
}
