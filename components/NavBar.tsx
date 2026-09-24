"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL, type Profile } from "@/lib/types";

const TABS = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/agenda", label: "Agenda" },
  { href: "/pacientes", label: "Pacientes" },
  { href: "/farmacia", label: "Farmacia" },
  { href: "/equipo", label: "Equipo" },
];

export default function NavBar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-950/95 text-slate-50 shadow-[0_10px_30px_rgba(8,15,31,0.18)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 text-xl shadow-lg shadow-cyan-500/20">
            🩺
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold tracking-tight text-white">Consultorio San Juan</h1>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Farmacia · Expedientes · Equipo</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-slate-100">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="font-medium">{profile.nombre}</span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-300">{ROLE_LABEL[profile.rol]}</span>
          </span>
          <button onClick={signOut} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-white/10">
            Cerrar sesión
          </button>
        </div>
      </div>

      <nav className="mx-auto max-w-7xl border-t border-white/10 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center gap-1 overflow-x-auto py-2">
          {TABS.map((t) => {
            const active = pathname?.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition duration-200 after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:-translate-x-1/2 after:rounded-full after:bg-cyan-400 after:transition-all after:duration-200 ${
                  active
                    ? "bg-white text-slate-900 shadow-sm after:w-8"
                    : "text-slate-300 hover:-translate-y-0.5 hover:bg-white/5 hover:text-white after:w-0 hover:after:w-4"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
