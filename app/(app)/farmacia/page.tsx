"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Medicamento, Profile, Venta, VentaItem } from "@/lib/types";
import { descargarTicket } from "@/lib/pdf";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowHM() {
  return new Date().toTimeString().slice(0, 5);
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
function money(n: number) {
  return "$" + (Number(n) || 0).toFixed(2);
}

type CartLine = { medId: string; cantidad: number };

export default function FarmaciaPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meds, setMeds] = useState<Medicamento[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [showMedForm, setShowMedForm] = useState(false);
  const [medForm, setMedForm] = useState({ nombre: "", presentacion: "", stock: "0", precio: "0", caducidad: "" });

  const [selMed, setSelMed] = useState("");
  const [selCant, setSelCant] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cobrando, setCobrando] = useState(false);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
      setProfile(prof as Profile);
    }
    const { data: medsData } = await supabase.from("medicamentos").select("*").order("nombre");
    setMeds((medsData as Medicamento[]) || []);
    if (medsData && medsData.length && !selMed) setSelMed(medsData[0].id);

    const { data: ventasData } = await supabase
      .from("ventas")
      .select("*")
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false })
      .limit(10);
    setVentas((ventasData as Venta[]) || []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("farmacia-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "medicamentos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ventas" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearMedicamento(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("medicamentos").insert({
      nombre: medForm.nombre,
      presentacion: medForm.presentacion,
      stock: Number(medForm.stock),
      precio: Number(medForm.precio),
      caducidad: medForm.caducidad || null,
    });
    setMedForm({ nombre: "", presentacion: "", stock: "0", precio: "0", caducidad: "" });
    setShowMedForm(false);
  }

  async function eliminarMedicamento(id: string) {
    if (confirm("¿Eliminar este medicamento del catálogo?")) {
      await supabase.from("medicamentos").delete().eq("id", id);
    }
  }

  function agregarAlCarrito() {
    if (!selMed) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.medId === selMed);
      if (existing) return prev.map((l) => (l.medId === selMed ? { ...l, cantidad: l.cantidad + selCant } : l));
      return [...prev, { medId: selMed, cantidad: selCant }];
    });
  }
  function quitarDelCarrito(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  const cartTotal = cart.reduce((sum, l) => {
    const m = meds.find((x) => x.id === l.medId);
    return sum + (m ? m.precio * l.cantidad : 0);
  }, 0);

  async function cobrar() {
    if (!profile || !cart.length) return;
    for (const l of cart) {
      const m = meds.find((x) => x.id === l.medId);
      if (!m || l.cantidad > m.stock) {
        alert(`No hay suficiente stock de ${m?.nombre || "un producto"}`);
        return;
      }
    }
    setCobrando(true);
    const items: VentaItem[] = cart.map((l) => {
      const m = meds.find((x) => x.id === l.medId)!;
      return { medicamento_id: m.id, nombre: m.nombre, cantidad: l.cantidad, precio: m.precio };
    });
    const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const folio = Math.floor(Date.now() / 1000).toString().slice(-6);
    const fecha = todayISO();
    const hora = nowHM();

    const { data: ventaRow } = await supabase
      .from("ventas")
      .insert({ folio, total, fecha, hora, vendedor_id: profile.id, vendedor_nombre: profile.nombre })
      .select()
      .single();

    if (ventaRow) {
      await supabase.from("venta_items").insert(
        items.map((it) => ({
          venta_id: ventaRow.id,
          medicamento_id: it.medicamento_id,
          nombre: it.nombre,
          cantidad: it.cantidad,
          precio: it.precio,
        }))
      );
      for (const it of items) {
        const m = meds.find((x) => x.id === it.medicamento_id)!;
        await supabase.from("medicamentos").update({ stock: m.stock - it.cantidad }).eq("id", it.medicamento_id);
      }
      await descargarTicket(ventaRow as Venta, items);
    }

    setCart([]);
    setCobrando(false);
  }

  async function reimprimir(ventaId: string) {
    const venta = ventas.find((v) => v.id === ventaId);
    if (!venta) return;
    const { data: items } = await supabase.from("venta_items").select("*").eq("venta_id", ventaId);
    await descargarTicket(venta, (items as VentaItem[]) || []);
  }

  return (
    <>
      <div className="card">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="font-serif text-xl">Catálogo de medicamentos</h2>
          <button className="btn-secondary" onClick={() => setShowMedForm((v) => !v)}>
            + Agregar medicamento
          </button>
        </div>
        {showMedForm && (
          <form onSubmit={crearMedicamento} className="mt-3 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="field">
                <label>Nombre</label>
                <input required value={medForm.nombre} onChange={(e) => setMedForm({ ...medForm, nombre: e.target.value })} />
              </div>
              <div className="field">
                <label>Presentación</label>
                <input
                  value={medForm.presentacion}
                  onChange={(e) => setMedForm({ ...medForm, presentacion: e.target.value })}
                  placeholder="Caja 20 tab, jarabe 120ml…"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="field">
                <label>Existencia</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={medForm.stock}
                  onChange={(e) => setMedForm({ ...medForm, stock: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Precio</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={medForm.precio}
                  onChange={(e) => setMedForm({ ...medForm, precio: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Caducidad</label>
                <input type="date" value={medForm.caducidad} onChange={(e) => setMedForm({ ...medForm, caducidad: e.target.value })} />
              </div>
            </div>
            <button className="btn" type="submit">
              Guardar medicamento
            </button>
          </form>
        )}
        <div className="overflow-x-auto mt-3">
          {meds.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-neutral-500 border-b-2 border-[var(--line)]">
                  <th className="py-2">Medicamento</th>
                  <th>Presentación</th>
                  <th>Stock</th>
                  <th>Precio</th>
                  <th>Caduca</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {meds.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--line)]">
                    <td className="py-2">{m.nombre}</td>
                    <td>{m.presentacion || "—"}</td>
                    <td className={m.stock <= 5 ? "text-red-700 font-bold" : ""}>{m.stock}</td>
                    <td>{money(m.precio)}</td>
                    <td>{fmtDate(m.caducidad)}</td>
                    <td>
                      <button className="text-red-700 text-xs" onClick={() => eliminarMedicamento(m.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-neutral-500 border border-dashed border-[var(--line)] rounded-lg p-4 text-center">
              No hay medicamentos registrados.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-serif text-xl">Registrar venta</h2>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <div className="field">
            <label>Medicamento</label>
            <select value={selMed} onChange={(e) => setSelMed(e.target.value)}>
              {meds.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} (stock {m.stock}) — {money(m.precio)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input type="number" min={1} value={selCant} onChange={(e) => setSelCant(Number(e.target.value) || 1)} />
          </div>
        </div>
        <button className="btn-secondary mt-1" type="button" onClick={agregarAlCarrito}>
          Agregar al ticket
        </button>

        {cart.length > 0 && (
          <div className="mt-4">
            {cart.map((l, i) => {
              const m = meds.find((x) => x.id === l.medId);
              return (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center py-1.5 border-b border-[var(--line)] text-sm">
                  <span>{m?.nombre || "?"}</span>
                  <span>x{l.cantidad}</span>
                  <span>{m ? money(m.precio * l.cantidad) : ""}</span>
                  <button className="text-red-700 text-xs" onClick={() => quitarDelCarrito(i)}>
                    Quitar
                  </button>
                </div>
              );
            })}
            <div className="flex justify-between items-center mt-3">
              <strong>Total: {money(cartTotal)}</strong>
              <button className="btn" onClick={cobrar} disabled={cobrando}>
                {cobrando ? "Procesando…" : "Cobrar y generar ticket"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-serif text-xl mb-3">Ventas recientes</h2>
        {ventas.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-neutral-500 border-b-2 border-[var(--line)]">
                <th className="py-2">Folio</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Vendió</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className="border-b border-[var(--line)]">
                  <td className="py-2">#{v.folio}</td>
                  <td>
                    {fmtDate(v.fecha)} {v.hora?.slice(0, 5)}
                  </td>
                  <td>{money(v.total)}</td>
                  <td>{v.vendedor_nombre}</td>
                  <td>
                    <button className="text-teal-700 underline text-xs font-semibold" onClick={() => reimprimir(v.id)}>
                      Reimprimir ticket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-neutral-500 border border-dashed border-[var(--line)] rounded-lg p-4 text-center">
            Aún no hay ventas registradas.
          </p>
        )}
      </div>
    </>
  );
}
