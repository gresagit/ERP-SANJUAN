"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL, type Profile } from "@/lib/types";

export default function EquipoPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
      setProfile(prof as Profile);
    }
    const { data } = await supabase.from("profiles").select("*").order("nombre");
    setStaff((data as Profile[]) || []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("equipo-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function eliminarMiembro(id: string) {
    if (!confirm("¿Eliminar a este miembro del equipo? Su cuenta de acceso seguirá existiendo; solo se borra su perfil.")) return;
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) setMsg("No se pudo eliminar (solo un administrador puede hacerlo).");
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Administración</p>
        <h2 className="font-serif text-3xl text-slate-800">Equipo del consultorio</h2>
      </header>
      <div className="card">
        <p className="mb-5 max-w-2xl text-sm leading-6 text-slate-500">
          Cada persona crea su propia cuenta desde la pantalla de registro (correo y contraseña) y completa su
          perfil. Aquí solo se ve el equipo ya dado de alta.
        </p>
        {msg && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</p>}
        {staff.length ? (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2">Nombre</th>
                <th>Rol</th>
                <th>Especialidad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-3 font-semibold text-slate-700">{p.nombre}</td>
                  <td>
                    <span className="pill bg-teal-100 text-teal-700">{ROLE_LABEL[p.rol]}</span>
                  </td>
                  <td className="text-slate-600">{p.especialidad || "—"}</td>
                  <td>
                    {p.id !== profile?.id ? (
                        <button className="text-xs font-semibold text-rose-700 hover:text-rose-800" onClick={() => eliminarMiembro(p.id)}>
                        Eliminar
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-500">(tú)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 border border-dashed border-[var(--line)] rounded-lg p-4 text-center">
            Sin personal registrado.
          </p>
        )}
      </div>
    </div>
  );
}
