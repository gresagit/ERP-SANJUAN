"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message || "Correo o contraseña incorrectos.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1b3447] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[#2c4a63] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:p-8">
        <div className="mb-7 rounded-xl border border-[#e2e6e8] bg-white p-3">
          <img src="/logo-sanjuan-completo.png" alt="SAN JUAN Servicios de Salud" className="h-auto w-full" />
        </div>
        <p className="mb-6 text-sm text-slate-500">Inicia sesión con tu cuenta del consultorio.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label>Correo</label>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-20" />
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
          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-5 text-sm text-slate-500">
          ¿Primera vez aquí?{" "}
          <Link href="/signup" className="text-teal-700 underline font-semibold">
            Crea tu cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}
