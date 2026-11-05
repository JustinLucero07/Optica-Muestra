// Reglas de coherencia método de pago ↔ cuenta (espejo de backend/app/core/metodos_pago.py)
//  - Cuenta de efectivo → solo efectivo
//  - Banco / electrónica → transferencia, depósito, cheque (nunca efectivo; en cobros tampoco tarjeta)
//  - Máquina / datáfono → en cobros solo tarjeta

export interface CuentaLite { id: number; nombre: string; tipo: string; activa?: boolean }

const MAQUINA = /maquina|máquina|dataf|datáf|\bpos\b/i

export const esTarjeta = (m: string) => (m ?? "").toLowerCase().startsWith("tarjeta")

export function esCuentaMaquina(c: CuentaLite) {
  return (c.tipo ?? "").toLowerCase() === "otro" && MAQUINA.test(c.nombre ?? "")
}

export function cuentaAdmiteMetodo(c: CuentaLite, metodo: string, esIngreso: boolean): boolean {
  const t = (c.tipo ?? "").toLowerCase()
  const m = (metodo ?? "").toLowerCase()
  if (t === "efectivo") return m === "efectivo"
  if (t === "banco" || t === "electronico") {
    if (m === "efectivo") return false
    if (esIngreso && esTarjeta(m)) return false
    return true
  }
  if (esIngreso && esCuentaMaquina(c)) return esTarjeta(m)
  return true
}

/** Cuentas activas que admiten el método (más `incluirId` aunque esté inactiva, para no perder la cuenta actual al editar). */
export function cuentasParaMetodo<T extends CuentaLite>(cuentas: T[], metodo: string, esIngreso: boolean, incluirId?: number): T[] {
  return cuentas.filter(c => (c.activa !== false || c.id === incluirId) && cuentaAdmiteMetodo(c, metodo, esIngreso))
}

/** Cuenta sugerida para un método: efectivo → caja de efectivo, tarjeta → máquina, resto → primera compatible. */
export function cuentaPorDefecto<T extends CuentaLite>(cuentas: T[], metodo: string, esIngreso: boolean): T | undefined {
  const validas = cuentasParaMetodo(cuentas, metodo, esIngreso)
  if (metodo === "efectivo") return validas.find(c => /efectivo/i.test(c.nombre)) ?? validas[0]
  if (esTarjeta(metodo)) return validas.find(esCuentaMaquina) ?? validas[0]
  return validas[0]
}

/** Métodos de pago que acepta el backend (un solo lugar para todo el sistema). */
export const METODOS_PAGO = ["efectivo", "transferencia", "tarjeta_debito", "tarjeta_credito", "cheque", "deposito"] as const

export const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta_debito: "Tarjeta de débito",
  tarjeta_credito: "Tarjeta de crédito",
  cheque: "Cheque",
  deposito: "Depósito",
  tarjeta: "Tarjeta",
}

export const metodoLabel = (m: string) => METODO_LABEL[m] ?? m
