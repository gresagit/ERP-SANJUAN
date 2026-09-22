import type { Consulta, Paciente, Venta, VentaItem } from "./types";

const CLINIC = "Consultorio San Juan";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
function money(n: number) {
  return "$" + (Number(n) || 0).toFixed(2);
}

export async function descargarPlanTratamiento(paciente: Paciente, consulta: Consulta) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(CLINIC, 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Plan de tratamiento", 14, y);
  y += 10;
  doc.setDrawColor(180);
  doc.line(14, y, 196, y);
  y += 8;

  const line = (label: string, val: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(val || "—", 45, y);
    y += 7;
  };
  line("Paciente:", paciente.nombre);
  line("Fecha:", fmtDate(consulta.fecha));
  line("Atendió:", consulta.doctor_nombre || "—");
  y += 3;

  const block = (title: string, text: string | null) => {
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text || "—", 180);
    doc.text(lines, 14, y);
    y += lines.length * 6 + 6;
  };
  block("Motivo de consulta", consulta.motivo);
  block("Diagnóstico", consulta.diagnostico);
  block("Plan de tratamiento", consulta.tratamiento);
  if (consulta.requiere_enfermera) {
    block("Indicaciones de enfermería", "Este tratamiento requiere seguimiento de enfermería en el consultorio.");
  }
  if (consulta.canaliza_area) {
    block(
      "Canalización",
      `Referido a ${consulta.canaliza_area}${
        consulta.canaliza_profesional_nombre ? " — " + consulta.canaliza_profesional_nombre : ""
      }. Motivo: ${consulta.canaliza_motivo || "—"}`
    );
  }

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    "Documento generado por el sistema interno de " + CLINIC + ". No sustituye receta médica oficial si esta se requiere por separado.",
    14,
    285
  );

  doc.save(`plan-tratamiento-${paciente.nombre.replace(/\s+/g, "_")}-${consulta.fecha}.pdf`);
}

export async function descargarResumenExpediente(paciente: Paciente, consultas: Consulta[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(CLINIC, 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Resumen de expediente clínico", 14, y);
  y += 10;
  doc.setDrawColor(180);
  doc.line(14, y, 196, y);
  y += 8;

  const line = (label: string, val: string | null) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(val || "—", 60, y);
    y += 7;
  };
  line("Nombre:", paciente.nombre);
  line("Fecha de nacimiento:", fmtDate(paciente.fecha_nacimiento));
  line("Sexo:", paciente.sexo);
  line("Teléfono:", paciente.telefono);
  line("Alergias:", paciente.alergias);
  y += 3;

  const block = (title: string, text: string | null) => {
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text || "—", 180);
    doc.text(lines, 14, y);
    y += lines.length * 6 + 5;
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
  };
  block("Antecedentes heredofamiliares", paciente.antecedentes_hf);
  block("Antecedentes personales patológicos", paciente.antecedentes_pp);
  block("Antecedentes personales no patológicos", paciente.antecedentes_pnp);

  doc.setFont("helvetica", "bold");
  doc.text("Historial de consultas", 14, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  if (!consultas.length) {
    doc.text("Sin consultas registradas.", 14, y);
  }
  consultas.forEach((c) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.text(`${fmtDate(c.fecha)} — ${c.doctor_nombre || "—"}`, 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(`Diagnóstico: ${c.diagnostico || "—"}\nTratamiento: ${c.tratamiento || "—"}`, 180);
    doc.text(lines, 14, y);
    y += lines.length * 6 + 6;
  });

  doc.save(`expediente-${paciente.nombre.replace(/\s+/g, "_")}.pdf`);
}

export async function descargarTicket(venta: Venta, items: VentaItem[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: [80, 150] });
  let y = 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(CLINIC, 40, y, { align: "center" });
  y += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Farmacia interna — Ticket de venta", 40, y, { align: "center" });
  y += 6;
  doc.text(`Folio: ${venta.folio}`, 6, y);
  y += 4;
  doc.text(`Fecha: ${fmtDate(venta.fecha)} ${venta.hora}`, 6, y);
  y += 4;
  doc.text(`Atendió: ${venta.vendedor_nombre || "—"}`, 6, y);
  y += 5;
  doc.setDrawColor(150);
  doc.line(6, y, 74, y);
  y += 5;

  items.forEach((it) => {
    doc.text(it.nombre, 6, y);
    y += 4;
    doc.text(`${it.cantidad} x ${money(it.precio)}`, 6, y);
    doc.text(money(it.cantidad * it.precio), 74, y, { align: "right" });
    y += 5;
  });
  doc.line(6, y, 74, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", 6, y);
  doc.text(money(venta.total), 74, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Gracias por su visita.", 40, y, { align: "center" });

  doc.save(`ticket-${venta.folio}.pdf`);
}
