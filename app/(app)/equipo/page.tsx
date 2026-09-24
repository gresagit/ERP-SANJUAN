"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL, type AccessRequest, type Profile } from "@/lib/types";

export default function EquipoPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
      setProfile(prof as Profile);
    }
    const { data } = await supabase.from("profiles").select("*").order("nombre");
    setStaff((data as Profile[]) || []);
    const { data: requestData } = await supabase.from("access_requests").select("*").eq("status", "pending").order("created_at", { ascending: false });
    setRequests((requestData as AccessRequest[]) || []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("equipo-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "access_requests" }, load)
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

  async function resolverSolicitud(request: AccessRequest, status: "approved" | "rejected") {
    if (!profile || profile.rol !== "admin") return;
    if (status === "approved") {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: request.user_id,
        nombre: `${request.nombre} ${request.apellido}`.trim(),
        apellido: request.apellido,
        fecha_nacimiento: request.fecha_nacimiento,
        rol: request.requested_role,
        especialidad: request.especialidad || request.desempeno || null,
      });
      if (profileError) {
        setMsg("No se pudo activar el perfil: " + profileError.message);
        return;
      }
    }
    const { error } = await supabase.from("access_requests").update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq("id", request.id);
    if (error) setMsg("No se pudo actualizar la solicitud: " + error.message);
    await load();
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
      {profile?.rol === "admin" && requests.length > 0 && (
        <div className="card border-cyan-200 bg-cyan-50/40">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-800">Solicitudes de acceso</h3><p className="mt-1 text-sm text-slate-500">Aprueba el personal antes de habilitar su cuenta.</p></div><span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700">{requests.length} pendientes</span></div>
          <div className="space-y-3">{requests.map((request) => <div key={request.id} className="flex flex-col gap-4 rounded-2xl border border-cyan-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{request.nombre} {request.apellido}</p><p className="text-sm text-slate-600">{request.email}</p><p className="text-xs text-slate-500">{request.especialidad} · {request.desempeno} · Nacimiento: {request.fecha_nacimiento}</p></div><div className="flex shrink-0 gap-2"><button className="btn-secondary" onClick={() => resolverSolicitud(request, "rejected")}>Rechazar</button><button className="btn" onClick={() => resolverSolicitud(request, "approved")}>Dar visto bueno</button></div></div>)}</div>
        </div>
      )}
    </div>
  );
}
