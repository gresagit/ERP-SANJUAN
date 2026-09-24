export type StaffRole = "admin" | "doctor" | "enfermera" | "fisioterapeuta" | "nutriologo" | "farmacia" | "recepcion";

export type Profile = {
  id: string;
  nombre: string;
  rol: StaffRole;
  especialidad: string | null;
};

export type Paciente = {
  id: string;
  nombre: string;
  fecha_nacimiento: string | null;
  sexo: string | null;
  telefono: string | null;
  domicilio: string | null;
  alergias: string | null;
  antecedentes_hf: string | null;
  antecedentes_pp: string | null;
  antecedentes_pnp: string | null;
  created_at: string;
};

export type Consulta = {
  id: string;
  paciente_id: string;
  doctor_id: string | null;
  doctor_nombre: string | null;
  fecha: string;
  motivo: string | null;
  exploracion: string | null;
  diagnostico: string | null;
  tratamiento: string | null;
  requiere_enfermera: boolean;
  enfermeria_estado: string | null;
  enfermera_id: string | null;
  canaliza_area: string | null;
  canaliza_profesional_id: string | null;
  canaliza_profesional_nombre: string | null;
  canaliza_motivo: string | null;
  canaliza_estado: string | null;
};

export type Receta = {
  id: string;
  paciente_id: string;
  consulta_id: string | null;
  doctor_id: string | null;
  doctor_nombre: string | null;
  fecha: string;
  diagnostico: string;
  tratamiento: string;
  medicamento: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
  indicaciones: string | null;
  created_at: string;
};

export type ReferralRequest = {
  id: string;
  paciente_id: string;
  paciente_nombre: string;
  consulta_id: string | null;
  sender_id: string;
  sender_nombre: string;
  recipient_id: string;
  recipient_nombre: string;
  area: string;
  motivo: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  responded_at: string | null;
};

export type Cita = {
  id: string;
  profesional_id: string | null;
  profesional_nombre: string | null;
  paciente_id: string | null;
  paciente_nombre: string;
  fecha: string;
  hora: string;
  motivo: string | null;
  estado: string;
};

export type Medicamento = {
  id: string;
  nombre: string;
  presentacion: string | null;
  stock: number;
  precio: number;
  caducidad: string | null;
};

export type VentaItem = {
  medicamento_id: string;
  nombre: string;
  cantidad: number;
  precio: number;
};

export type Venta = {
  id: string;
  folio: string;
  total: number;
  fecha: string;
  hora: string;
  vendedor_nombre: string | null;
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Administrador(a)",
  doctor: "Doctor(a)",
  enfermera: "Enfermería",
  fisioterapeuta: "Fisioterapia",
  nutriologo: "Nutriología",
  farmacia: "Farmacia",
  recepcion: "Recepción",
};
