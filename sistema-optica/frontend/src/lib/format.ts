// Formatos de presentación compartidos por todo el sistema.
// Un único formato de dinero y fecha para que todas las pantallas se vean igual.

const moneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" })

/** $1.234,50 — acepta number, string numérico, null o undefined (→ "—"). */
export function fmtMoney(v: number | string | null | undefined, vacio = "—"): string {
  if (v == null || v === "") return vacio
  const n = Number(v)
  return Number.isFinite(n) ? moneda.format(n) : vacio
}

/** "2026-11-04" o ISO con hora → "04/11/2026". */
export function fmtDate(s: string | null | undefined, vacio = "—"): string {
  if (!s) return vacio
  const [y, m, d] = s.slice(0, 10).split("-")
  return d && m && y ? `${d}/${m}/${y}` : vacio
}

/** Fecha local (no UTC) en formato YYYY-MM-DD. Evita que después de las 19:00
 *  en Ecuador (UTC-5) el sistema registre la fecha del día siguiente. */
export function isoLocal(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${dd}`
}

export const hoyISO = () => isoLocal()

/** Primer y último día del mes desplazado `offset` meses desde hoy (0 = mes actual). */
export function rangoMes(offset: number): { desde: string; hasta: string } {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  const inicio = new Date(d.getFullYear(), d.getMonth(), 1)
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { desde: isoLocal(inicio), hasta: isoLocal(fin) }
}

/** "noviembre de 2026" para el mes desplazado `offset` meses desde hoy. */
export function nombreMes(offset: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return d.toLocaleDateString("es-EC", { month: "long", year: "numeric" })
}
