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
    <header className="bg-gradient-to-b from-teal-900 to-teal-700 text-sand-50 border-b-[3px] border-ochre-500 sticky top-0 z-20 pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-5xl mx-auto px-4 pt-3 pb-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl">🩺</span>
          <div>
            <h1 className="font-serif text-lg font-semibold m-0">Consultorio San Juan</h1>
            <small className="opacity-75 text-xs block">Farmacia · Expedientes · Equipo</small>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="bg-white/10 border border-white/30 rounded-full px-3 py-1.5 flex items-center gap-2">
            {profile.nombre} <span className="opacity-70 text-xs">· {ROLE_LABEL[profile.rol]}</span>
          </span>
          <button onClick={signOut} className="btn-ghost">
            Cerrar sesión
          </button>
        </div>
      </div>
      <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3.5 py-2 text-sm font-semibold rounded-t-md border-b-[3px] whitespace-nowrap ${
              pathname?.startsWith(t.href)
                ? "bg-white text-teal-700 border-ochre-500"
                : "text-white/80 border-transparent hover:bg-white/10"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
