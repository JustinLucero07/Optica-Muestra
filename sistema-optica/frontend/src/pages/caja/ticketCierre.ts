// Ticket de cierre de caja para impresora térmica de 80 mm.
import { api } from "@/lib/api"
import { fmtDate, fmtMoney, isoLocal } from "@/lib/format"
import { getNegocio } from "@/lib/negocio"
import { metodoLabel } from "@/lib/metodosCuenta"
import { estadoLabel } from "@/lib/estados"
import { openPrintWindow } from "@/lib/pdf"
import { useAuthStore } from "@/store/auth"

export interface CajaTicket {
  fecha: string
  estado: string
  saldo_apertura: number
  total_efectivo: number | null
  total_tarjeta: number | null
  total_transferencia: number | null
  diferencia: number | null
  notas_apertura: string | null
  notas_cierre: string | null
}

interface Mov { numero: string; concepto: string; monto: number; metodo_pago: string }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
const n = (v: unknown) => Number(v) || 0

function porMetodo(movs: Mov[]): [string, number][] {
  const t: Record<string, number> = {}
  for (const m of movs) t[m.metodo_pago] = (t[m.metodo_pago] ?? 0) + n(m.monto)
  return Object.entries(t).sort((a, b) => b[1] - a[1])
}

const fila = (izq: string, der: string, clase = "") =>
  `<div class="fila ${clase}"><span>${izq}</span><span>${der}</span></div>`

/** Descarga los movimientos del día y abre el ticket listo para imprimir. */
export async function imprimirCierreCaja(caja: CajaTicket): Promise<void> {
  const params = { desde: caja.fecha, hasta: caja.fecha, limit: 5000 }
  const [cobros, egresos] = await Promise.all([
    api.get<Mov[]>("/cobros", { params }).then(r => r.data),
    api.get<Mov[]>("/egresos", { params }).then(r => r.data),
  ])
  const neg = getNegocio()
  const usuario = useAuthStore.getState().user?.full_name ?? ""

  const efectivoIn = cobros.filter(c => c.metodo_pago === "efectivo").reduce((s, c) => s + n(c.monto), 0)
  const efectivoOut = egresos.filter(e => e.metodo_pago === "efectivo").reduce((s, e) => s + n(e.monto), 0)
  const esperado = n(caja.saldo_apertura) + efectivoIn - efectivoOut
  const totalCobros = cobros.reduce((s, c) => s + n(c.monto), 0)
  const totalEgresos = egresos.reduce((s, e) => s + n(e.monto), 0)
  const cerrada = caja.estado === "cerrada"

  const egresosLista = egresos.slice(0, 25).map(e =>
    fila(esc(`${e.numero} ${e.concepto}`.slice(0, 28)), fmtMoney(e.monto), "peq")).join("")

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cierre de caja ${fmtDate(caja.fecha)}</title>
<style>
  @page { size: 80mm auto; margin: 0 }
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { width: 72mm; margin: 0 auto; padding: 4mm 0; font-family: "Courier New", monospace; font-size: 11px; color: #000 }
  .c { text-align: center } .b { font-weight: bold } .g { font-size: 14px }
  .sep { border-top: 1px dashed #000; margin: 6px 0 }
  .fila { display: flex; justify-content: space-between; gap: 6px; line-height: 1.5 }
  .fila span:last-child { white-space: nowrap }
  .peq { font-size: 10px }
  .tot { font-weight: bold; font-size: 12px }
  .firma { margin-top: 28px; border-top: 1px solid #000; text-align: center; padding-top: 2px; font-size: 10px }
  @media screen { body { background: #fff; box-shadow: 0 0 0 1px #ddd; margin-top: 10px } }
</style></head><body>
  <div class="c b g">${esc(neg.nombre)}</div>
  ${neg.direccion ? `<div class="c peq">${esc(neg.direccion)}</div>` : ""}
  ${neg.telefono ? `<div class="c peq">Tel. ${esc(neg.telefono)}</div>` : ""}
  <div class="sep"></div>
  <div class="c b">${cerrada ? "CIERRE DE CAJA" : "CORTE PARCIAL DE CAJA"}</div>
  <div class="c">${fmtDate(caja.fecha)} · ${esc(estadoLabel(caja.estado))}</div>
  <div class="sep"></div>

  <div class="b">EFECTIVO EN CAJA</div>
  ${fila("Saldo de apertura", fmtMoney(caja.saldo_apertura))}
  ${fila("+ Cobros en efectivo", fmtMoney(efectivoIn))}
  ${fila("- Egresos en efectivo", fmtMoney(efectivoOut))}
  ${fila("= Debe haber en caja", fmtMoney(esperado), "tot")}

  <div class="sep"></div>
  <div class="b">COBROS DEL DÍA (${cobros.length})</div>
  ${porMetodo(cobros).map(([m, v]) => fila(esc(metodoLabel(m)), fmtMoney(v))).join("") || `<div class="peq">Sin cobros</div>`}
  ${fila("Total cobrado", fmtMoney(totalCobros), "tot")}

  <div class="sep"></div>
  <div class="b">EGRESOS DEL DÍA (${egresos.length})</div>
  ${egresosLista || `<div class="peq">Sin egresos</div>`}
  ${egresos.length > 25 ? `<div class="peq">… y ${egresos.length - 25} más</div>` : ""}
  ${fila("Total egresos", fmtMoney(totalEgresos), "tot")}

  ${cerrada ? `
  <div class="sep"></div>
  <div class="b">DECLARADO AL CERRAR</div>
  ${fila("Efectivo", fmtMoney(caja.total_efectivo ?? 0))}
  ${fila("Tarjeta", fmtMoney(caja.total_tarjeta ?? 0))}
  ${fila("Transferencia", fmtMoney(caja.total_transferencia ?? 0))}
  ${fila("Diferencia", fmtMoney(caja.diferencia ?? 0), "tot")}
  ${caja.diferencia && Math.abs(n(caja.diferencia)) > 0.009
    ? `<div class="peq">${n(caja.diferencia) > 0 ? "Sobrante" : "Faltante"} respecto a lo cobrado en el sistema</div>` : ""}` : `
  <div class="sep"></div>
  <div class="c b">CAJA AÚN ABIERTA</div>`}

  ${caja.notas_cierre ? `<div class="sep"></div><div class="peq">Notas: ${esc(caja.notas_cierre)}</div>` : ""}

  <div class="firma">Entregado por</div>
  <div class="firma">Recibido por</div>
  <div class="sep"></div>
  <div class="c peq">Impreso ${fmtDate(isoLocal())} ${new Date().toTimeString().slice(0, 5)}${usuario ? ` por ${esc(usuario)}` : ""}</div>
  <script>window.onload = () => window.print()</script>
</body></html>`
  openPrintWindow(html, 420, 800)
}
