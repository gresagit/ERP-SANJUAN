"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { StaffRole } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [rol, setRol] = useState<StaffRole>("doctor");
  const [especialidad, setEspecialidad] = useState("");
  const [desempeno, setDesempeno] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      const metadata = data.user.user_metadata || {};
      setNombre(metadata.nombre || "");
      setApellido(metadata.apellido || "");
      setFechaNacimiento(metadata.fecha_nacimiento || "");
      setEspecialidad(metadata.especialidad || "");
      setDesempeno(metadata.desempeno || "");
      setRol(metadata.requested_role || "doctor");
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
    const metadata = userData.user.user_metadata || {};
    const { data: existing } = await supabase.from("access_requests").select("status").eq("user_id", userData.user.id).maybeSingle();
    if (existing?.status === "pending") {
      setLoading(false);
      setError("Tu solicitud ya está pendiente de revisión por un administrador.");
      return;
    }
    if (existing?.status === "approved") {
      setLoading(false);
      setError("Tu solicitud fue aprobada. Cierra sesión e inicia sesión nuevamente.");
      return;
    }
    const { error } = await supabase.from("access_requests").upsert({
      user_id: userData.user.id,
      email: userData.user.email,
      nombre: nombre || metadata.nombre || "",
      apellido: apellido || metadata.apellido || "",
      fecha_nacimiento: fechaNacimiento || metadata.fecha_nacimiento || "",
      especialidad: especialidad || metadata.especialidad || "",
      desempeno: desempeno || metadata.desempeno || "",
      requested_role: metadata.requested_role || rol,
    });
    setLoading(false);
    if (error) {
      setError("No se pudo guardar tu perfil: " + error.message);
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full">
        <h1 className="font-serif text-2xl text-teal-700 mb-1">Solicita acceso</h1>
        <p className="text-sm text-neutral-600 mb-6">Un administrador revisará tus datos antes de activar tu cuenta.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label>Nombre completo</label>
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Dra. Ana Ruiz" />
          </div>
          <div className="field"><label>Apellido</label><input required value={apellido} onChange={(e) => setApellido(e.target.value)} /></div>
          <div className="field"><label>Fecha de nacimiento</label><input type="date" required value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} /></div>
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
          <div className="field"><label>Desempeño o función</label><input required value={desempeno} onChange={(e) => setDesempeno(e.target.value)} placeholder="Consulta, recepción, enfermería…" /></div>
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
            {loading ? "Enviando…" : "Enviar solicitud"}
          </button>
        </form>
      </div>
    </div>
  );
}
