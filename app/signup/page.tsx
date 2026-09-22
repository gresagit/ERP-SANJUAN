"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      // Confirmación de correo desactivada: entra directo a completar su perfil
      router.push("/onboarding");
      router.refresh();
    } else {
      setInfo("Te enviamos un correo de confirmación. Ábrelo, inicia sesión y completa tu perfil.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full">
        <h1 className="font-serif text-2xl text-teal-700 mb-1">Crea tu cuenta</h1>
        <p className="text-sm text-neutral-600 mb-6">Para el personal de Consultorio San Juan.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label>Correo</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {info && <p className="text-sm text-teal-700">{info}</p>}
          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
        </form>
        <p className="text-sm text-neutral-600 mt-5">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-teal-700 underline font-semibold">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
