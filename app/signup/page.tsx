"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { StaffRole } from "@/lib/types";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [desempeno, setDesempeno] = useState("");
  const [requestedRole, setRequestedRole] = useState<StaffRole>("doctor");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre, apellido, fecha_nacimiento: fechaNacimiento, especialidad, desempeno, requested_role: requestedRole } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session && data.user) {
      const { error: requestError } = await supabase.from("access_requests").insert({
        user_id: data.user.id,
        email,
        nombre,
        apellido,
        fecha_nacimiento: fechaNacimiento,
        especialidad,
        desempeno,
        requested_role: requestedRole,
      });
      if (requestError) {
        setError("La cuenta se creó, pero no se pudo enviar la solicitud: " + requestError.message);
        return;
      }
      await supabase.auth.signOut();
      setInfo("Solicitud enviada. Un administrador debe aprobar tu acceso antes de que puedas entrar.");
    } else {
      setInfo("Te enviamos un correo de confirmación. Después de confirmarlo, inicia sesión para enviar tu solicitud de acceso.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1b3447] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[#2c4a63] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:p-8">
        <div className="mb-7 rounded-xl border border-[#e2e6e8] bg-white p-3">
          <img src="/logo-sanjuan-completo.png" alt="SAN JUAN Servicios de Salud" className="h-auto w-full" />
        </div>
        <h1 className="font-serif text-2xl text-[#1b3447]">Solicita acceso</h1>
        <p className="mb-6 text-sm text-slate-500">Solicita acceso al sistema del consultorio.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field"><label>Nombre</label><input required autoComplete="given-name" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
            <div className="field"><label>Apellido</label><input required autoComplete="family-name" value={apellido} onChange={(e) => setApellido(e.target.value)} /></div>
          </div>
          <div className="field"><label>Fecha de nacimiento</label><input type="date" required value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field"><label>Especialidad</label><input required value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} placeholder="Medicina general, fisioterapia…" /></div>
            <div className="field"><label>Desempeño o función</label><input required value={desempeno} onChange={(e) => setDesempeno(e.target.value)} placeholder="Consulta, recepción, enfermería…" /></div>
          </div>
          <div className="field"><label>Tipo de acceso solicitado</label><select value={requestedRole} onChange={(e) => setRequestedRole(e.target.value as StaffRole)}><option value="doctor">Médico general</option><option value="fisioterapeuta">Fisioterapia</option><option value="nutriologo">Nutriología</option><option value="enfermera">Enfermería</option><option value="recepcion">Recepción</option><option value="farmacia">Farmacia</option></select></div>
          <div className="field">
            <label>Correo</label>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {info && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}
          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
        </form>
        <p className="mt-5 text-sm text-slate-500">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-teal-700 underline font-semibold">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
