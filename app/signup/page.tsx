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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_#ccfbf1,_transparent_35%),radial-gradient(circle_at_bottom_right,_#dbeafe,_transparent_40%)] px-4 py-8">
      <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-xl text-white shadow-lg shadow-cyan-500/20">🩺</div>
          <div>
            <h1 className="font-serif text-2xl text-slate-800">Crea tu cuenta</h1>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Personal del consultorio</p>
          </div>
        </div>
        <p className="mb-6 text-sm text-slate-500">Registra tu acceso para completar tu perfil.</p>
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
