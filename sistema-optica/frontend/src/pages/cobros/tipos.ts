// Tipos y constantes de la pantalla Cobros y egresos.


export const CATEGORIAS_EGRESO = [
  "Alimentación", "Luz / Agua / Internet", "Arriendo", "Compras / Insumos",
  "Bisel y Lunas", "Motorizado", "Personal / Sueldos", "Publicidad", "Mantenimiento", "Otros",
]

export type Tab = "cobros" | "egresos" | "cxp" | "cuentas"

export interface Cuenta { id: number; nombre: string; tipo: string; saldo_actual: number; activa: boolean }
export interface Cobro { id: number; numero: string; fecha: string; concepto: string; monto: number; metodo_pago: string; venta_id: number | null }
export interface Egreso { id: number; numero: string; fecha: string; categoria: string; concepto: string; monto: number; metodo_pago: string }
export interface CxP { id: number; proveedor: string; concepto: string; monto_total: number; monto_pagado: number; fecha_emision: string; fecha_vencimiento: string | null; estado: string }
export interface CxPItem { id: number; codigo_proveedor: string | null; descripcion: string; cantidad: number; precio_unitario: number; subtotal: number; producto_id: number | null }
export interface ProductoMin { id: number; nombre: string; codigo: string | null }
export interface VentaPendiente { id: number; numero: string; total: number; estado: string; paciente_nombre: string | null; fecha: string }

export type CobroForm = { cuenta_bancaria_id: string; fecha: string; concepto: string; monto: string; metodo_pago: string; referencia: string; notas: string }
export type EgresoForm = { cuenta_bancaria_id: string; fecha: string; categoria: string; concepto: string; monto: string; metodo_pago: string; referencia: string; notas: string }
export type CxPForm = { proveedor: string; concepto: string; monto_total: string; fecha_emision: string; fecha_vencimiento: string; referencia: string; notas: string }
export type PagoForm = { monto: string; cuenta_bancaria_id: string; fecha: string; metodo_pago: string; referencia: string }
export type TransferenciaForm = { fecha: string; cuenta_origen_id: string; cuenta_destino_id: string; monto: string; comision: string; concepto: string; notas: string }
export type NuevaCuentaForm = { nombre: string; tipo: string; saldo_inicial: string }
export interface Transferencia { id: number; numero: string; fecha: string; cuenta_origen_id: number; cuenta_destino_id: number; monto: number; comision: number; concepto: string | null; created_at: string }
