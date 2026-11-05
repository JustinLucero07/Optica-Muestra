// Tipos, constantes y valores iniciales de las órdenes de laboratorio.
import { isoLocal } from "@/lib/format"

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Proveedor { id: number; nombre: string; tipo: string; telefono: string | null; ruc: string | null }

export interface Orden {
  id: number
  numero: string
  paciente_id: number
  paciente_nombre?: string | null
  paciente_telefono?: string | null
  consulta_id: number | null
  venta_id: number | null
  proveedor_id: number | null
  lab_proveedor: string
  lab_telefono: string | null
  referencia: string | null
  fecha_envio: string
  fecha_entrega_est: string | null
  fecha_entrega_real: string | null
  estado: string
  tipo: string
  descripcion: string
  precio_lab: number | null
  notas: string | null
  created_at: string
  updated_at: string
}


export interface RecetaItem {
  tipo: string
  lc_od_esf: number | null; lc_od_cil: number | null; lc_od_eje: number | null; lc_od_add: number | null
  lc_od_dnp: number | null; lc_oi_esf: number | null; lc_oi_cil: number | null; lc_oi_eje: number | null
  lc_oi_add: number | null; lc_oi_dnp: number | null; tipo_lente: string | null; tipo_armadura: string | null
  cl_od_esf: number | null; cl_od_cil: number | null; cl_od_eje: number | null
  cl_oi_esf: number | null; cl_oi_cil: number | null; cl_oi_eje: number | null
}
export interface ConsultaItem {
  id: number; numero: string; fecha: string; diagnostico: string | null
  rx_od_esf: number | null; rx_od_cil: number | null; rx_od_eje: number | null; rx_od_add: number | null
  rx_oi_esf: number | null; rx_oi_cil: number | null; rx_oi_eje: number | null; rx_oi_add: number | null
  recetas: RecetaItem[]
}

export interface ProductoMin { id: number; nombre: string; codigo: string | null; precio_costo: number | null; precio_venta: number | null; stock_actual: number | null }

export interface RxOjo { esf: string; cil: string; eje: string; add: string; prisma: string; dnp: string }
export const EMPTY_RX_OJO: RxOjo = { esf: "", cil: "", eje: "", add: "", prisma: "", dnp: "" }

export interface RxForm {
  od: RxOjo; oi: RxOjo
  dp: string; material: string; tratamiento: string
  diseno: string; diagnostico: string; recomendaciones: string
}
export const EMPTY_RX: RxForm = {
  od: { ...EMPTY_RX_OJO }, oi: { ...EMPTY_RX_OJO },
  dp: "", material: "", tratamiento: "", diseno: "", diagnostico: "", recomendaciones: "",
}

export interface OrdenParte {
  _id: string
  nombre: string
  ojos: "od" | "oi" | "ao"
  fuente: "lab" | "stock"
  proveedor_id: string
  lab_proveedor: string
  lab_telefono: string
  fecha_entrega_est: string
  precio_lab: string
  producto_id: string
}
export function newParte(nombre = "Completo"): OrdenParte {
  return {
    _id: Math.random().toString(36).slice(2), nombre, ojos: "ao", fuente: "lab",
    proveedor_id: "", lab_proveedor: "", lab_telefono: "",
    fecha_entrega_est: "", precio_lab: "", producto_id: "",
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
export const ESTADOS_ORDEN = ["pendiente", "enviado", "en_proceso", "listo", "entregado", "rechazado"]

export const ESTADO_BADGE_CLASS: Record<string, string> = {
  pendiente:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300",
  enviado:    "bg-blue-100   text-blue-800   dark:bg-blue-900/60   dark:text-blue-300",
  en_proceso: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300",
  listo:      "bg-green-100  text-green-800  dark:bg-green-900/60  dark:text-green-300",
  entregado:  "bg-slate-200  text-slate-700  dark:bg-slate-700     dark:text-slate-200",
  rechazado:  "bg-red-100    text-red-700    dark:bg-red-900/60    dark:text-red-300",
}

export const TIPOS_ORDEN = [
  "Lentes monofocales", "Lentes bifocales", "Lentes progresivos",
  "Lentes de contacto", "Filtros / antireflejo", "Armazón", "Reparación", "Otro",
]

export const PARTES_NOMBRES = ["Completo", "OD (ojo derecho)", "OI (ojo izquierdo)", "Ambos ojos", "Armazón", "Lentes de contacto", "Reparación", "Otro"]

export const EMPTY_FORM = {
  paciente_id: "",
  tipo: "Lentes monofocales",
  fecha_envio: isoLocal(new Date()),
  notas: "",
  referencia: "",
  armazon_ref: "",
  armazon_color: "",
  armazon_talla: "",
  precio_armazon: "",
  precio_lunas: "",
  precio_venta: "",
}
