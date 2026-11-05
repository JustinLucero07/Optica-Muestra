import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { Loader2, AlertCircle, Phone, Search, X, Receipt, CreditCard, HandCoins, FileSpreadsheet } from "lucide-react"

import { api } from "@/lib/api"
import { fmtMoney as fmt, fmtDate } from "@/lib/format"
import { Paginador } from "@/components/ui/Paginador"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { exportExcel } from "@/lib/excel"

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Bucket { total: number; count: number }

interface AgingCuotas {
  resumen: {
    total_cxc: number; total_vencido: number
    corriente: Bucket; dias_1_30: Bucket; dias_31_60: Bucket; dias_61_90: Bucket; mas_90: Bucket
  }
  cuotas: {
    cuota_id: number; credito_id: number; credito_numero: string
    cuota_numero: number; total_cuotas: number
    paciente_id: number; paciente_nombre: string; paciente_telefono: string | null
    fecha_vencimiento: string; saldo: number; dias_vencido: number; bucket: string
  }[]
}

interface SaldosVentas {
  resumen: { total: number; dias_0_30: Bucket; dias_31_60: Bucket; dias_61_90: Bucket; mas_90: Bucket }
  ventas: {
    venta_id: number; venta_numero: string; fecha: string
    paciente_id: number | null; paciente_nombre: string; paciente_telefono: string | null
    total: number; abonado: number; saldo: number; dias: number; bucket: string
  }[]
}

type Tab = "ventas" | "cuotas"

// ── Piezas ─────────────────────────────────────────────────────────────────────
function Tarjeta({ label, total, detalle, color = "", activa, onClick }: {
  label: string; total: number; detalle: string; color?: string; activa: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activa}
      className={`text-left rounded-xl border p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        activa ? "ring-2 ring-primary bg-primary/5" : "bg-card hover:bg-accent/30"}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{fmt(total)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{detalle}</p>
    </button>
  )
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

function Telefono({ tel }: { tel: string | null }) {
  if (!tel) return null
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
      <Phone className="h-3 w-3" /> {tel}
    </p>
  )
}

const th = "px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide"

// ── Página ─────────────────────────────────────────────────────────────────────
/** Todo lo que le deben a la óptica: saldos de ventas (abonos parciales) y cuotas de créditos. */
export default function CuentasPorCobrar() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get("tab") === "cuotas" ? "cuotas" : "ventas"
  const [bucket, setBucket] = useState("")
  const [busq, setBusq] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  const ventasQ = useQuery<SaldosVentas>({
    queryKey: ["cxc-ventas"],
    queryFn: () => api.get("/cxc/ventas").then(r => r.data),
    refetchInterval: 60_000,
  })
  const cuotasQ = useQuery<AgingCuotas>({
    queryKey: ["cxc-aging"],
    queryFn: () => api.get("/cxc/aging").then(r => r.data),
    refetchInterval: 60_000,
  })

  function cambiarTab(t: Tab) {
    setParams(t === "ventas" ? {} : { tab: t }, { replace: true })
    setBucket(""); setPage(1)
  }
  const filtrarBucket = (b: string) => { setBucket(bucket === b ? "" : b); setPage(1) }

  const rv = ventasQ.data?.resumen
  const rc = cuotasQ.data?.resumen
  const totalVentas = rv?.total ?? 0
  const totalCuotas = rc?.total_cxc ?? 0
  const q = busq.trim().toLowerCase()

  const ventas = (ventasQ.data?.ventas ?? []).filter(v =>
    (!bucket || v.bucket === bucket) &&
    (!q || v.paciente_nombre.toLowerCase().includes(q) || v.venta_numero.toLowerCase().includes(q)))
  const cuotas = (cuotasQ.data?.cuotas ?? []).filter(c =>
    (!bucket || c.bucket === bucket) &&
    (!q || c.paciente_nombre.toLowerCase().includes(q) || c.credito_numero.toLowerCase().includes(q)))

  function exportarExcel() {
    if (tab === "ventas") {
      exportExcel("saldos_de_ventas", "Saldos de ventas", [
        { titulo: "Paciente", valor: (v: typeof ventas[number]) => v.paciente_nombre },
        { titulo: "Teléfono", valor: v => v.paciente_telefono },
        { titulo: "Venta", valor: v => v.venta_numero },
        { titulo: "Fecha", valor: v => v.fecha, tipo: "fecha" },
        { titulo: "Total", valor: v => v.total, tipo: "moneda" },
        { titulo: "Abonado", valor: v => v.abonado, tipo: "moneda" },
        { titulo: "Saldo", valor: v => v.saldo, tipo: "moneda" },
        { titulo: "Días", valor: v => v.dias, tipo: "numero" },
      ], ventas)
    } else {
      exportExcel("cuotas_de_creditos", "Cuotas", [
        { titulo: "Paciente", valor: (c: typeof cuotas[number]) => c.paciente_nombre },
        { titulo: "Teléfono", valor: c => c.paciente_telefono },
        { titulo: "Crédito", valor: c => c.credito_numero },
        { titulo: "Cuota", valor: c => `${c.cuota_numero} de ${c.total_cuotas}` },
        { titulo: "Vencimiento", valor: c => c.fecha_vencimiento, tipo: "fecha" },
        { titulo: "Días vencida", valor: c => Math.max(0, c.dias_vencido), tipo: "numero" },
        { titulo: "Saldo", valor: c => c.saldo, tipo: "moneda" },
      ], cuotas)
    }
  }

  const cargando = tab === "ventas" ? ventasQ.isLoading : cuotasQ.isLoading
  const error = tab === "ventas" ? ventasQ.isError : cuotasQ.isError
  const filas = tab === "ventas" ? ventas.length : cuotas.length

  return (
    <div className="p-3 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HandCoins className="h-6 w-6" /> Cuentas por cobrar
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Todo lo que te deben los pacientes: ventas que pagaron en parte y cuotas de créditos.
        </p>
      </div>

      {/* Totales generales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total por cobrar</p>
          <p className="text-2xl font-bold tabular-nums">{fmt(totalVentas + totalCuotas)}</p>
        </div>
        <button type="button" onClick={() => cambiarTab("ventas")}
          className={`text-left rounded-xl border p-4 transition-all ${tab === "ventas" ? "ring-2 ring-primary bg-primary/5" : "bg-card hover:bg-accent/30"}`}>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> Saldos de ventas</p>
          <p className="text-2xl font-bold tabular-nums">{fmt(totalVentas)}</p>
          <p className="text-xs text-muted-foreground">{plural(ventasQ.data?.ventas.length ?? 0, "venta con abono parcial", "ventas con abono parcial")}</p>
        </button>
        <button type="button" onClick={() => cambiarTab("cuotas")}
          className={`text-left rounded-xl border p-4 transition-all ${tab === "cuotas" ? "ring-2 ring-primary bg-primary/5" : "bg-card hover:bg-accent/30"}`}>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Cuotas de créditos</p>
          <p className="text-2xl font-bold tabular-nums">{fmt(totalCuotas)}</p>
          <p className="text-xs text-muted-foreground">
            {rc && rc.total_vencido > 0 ? <span className="text-red-600">Vencido: {fmt(rc.total_vencido)}</span> : "Nada vencido"}
          </p>
        </button>
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {([["ventas", "Saldos de ventas", Receipt], ["cuotas", "Cuotas de créditos", CreditCard]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => cambiarTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 whitespace-nowrap transition-colors ${tab === id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Antigüedad (también filtra) */}
      {tab === "ventas" && rv && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tarjeta label="Hasta 30 días" total={rv.dias_0_30.total} detalle={plural(rv.dias_0_30.count, "venta", "ventas")} activa={bucket === "dias_0_30"} onClick={() => filtrarBucket("dias_0_30")} />
          <Tarjeta label="31 a 60 días" total={rv.dias_31_60.total} detalle={plural(rv.dias_31_60.count, "venta", "ventas")} color="text-amber-600" activa={bucket === "dias_31_60"} onClick={() => filtrarBucket("dias_31_60")} />
          <Tarjeta label="61 a 90 días" total={rv.dias_61_90.total} detalle={plural(rv.dias_61_90.count, "venta", "ventas")} color="text-orange-600" activa={bucket === "dias_61_90"} onClick={() => filtrarBucket("dias_61_90")} />
          <Tarjeta label="Más de 90 días" total={rv.mas_90.total} detalle={plural(rv.mas_90.count, "venta", "ventas")} color="text-red-600" activa={bucket === "mas_90"} onClick={() => filtrarBucket("mas_90")} />
        </div>
      )}
      {tab === "cuotas" && rc && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Tarjeta label="Al día (aún no vencen)" total={rc.corriente.total} detalle={plural(rc.corriente.count, "cuota", "cuotas")} color="text-green-600" activa={bucket === "corriente"} onClick={() => filtrarBucket("corriente")} />
          <Tarjeta label="Vencidas 1-30 días" total={rc.dias_1_30.total} detalle={plural(rc.dias_1_30.count, "cuota", "cuotas")} color="text-amber-600" activa={bucket === "dias_1_30"} onClick={() => filtrarBucket("dias_1_30")} />
          <Tarjeta label="Vencidas 31-60 días" total={rc.dias_31_60.total} detalle={plural(rc.dias_31_60.count, "cuota", "cuotas")} color="text-orange-600" activa={bucket === "dias_31_60"} onClick={() => filtrarBucket("dias_31_60")} />
          <Tarjeta label="Vencidas 61-90 días" total={rc.dias_61_90.total} detalle={plural(rc.dias_61_90.count, "cuota", "cuotas")} color="text-red-500" activa={bucket === "dias_61_90"} onClick={() => filtrarBucket("dias_61_90")} />
          <Tarjeta label="Vencidas +90 días" total={rc.mas_90.total} detalle={plural(rc.mas_90.count, "cuota", "cuotas")} color="text-red-700" activa={bucket === "mas_90"} onClick={() => filtrarBucket("mas_90")} />
        </div>
      )}

      {/* Búsqueda */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 pr-9 rounded-xl" value={busq} onChange={e => { setBusq(e.target.value); setPage(1) }}
            placeholder={tab === "ventas" ? "Buscar paciente o N° de venta…" : "Buscar paciente o N° de crédito…"} />
          {busq && (
            <button type="button" onClick={() => setBusq("")} title="Limpiar"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {bucket && <Button variant="ghost" size="sm" onClick={() => setBucket("")}>Quitar filtro de antigüedad</Button>}
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportarExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
        </Button>
      </div>

      {cargando && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>}
      {error && <div className="flex items-center gap-2 text-red-600"><AlertCircle className="h-4 w-4" /> No se pudieron cargar los datos.</div>}

      {!cargando && !error && (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {tab === "ventas" ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className={`${th} text-left`}>Paciente</th>
                    <th className={`${th} text-left`}>Venta</th>
                    <th className={`${th} text-left`}>Fecha</th>
                    <th className={`${th} text-right`}>Total</th>
                    <th className={`${th} text-right`}>Abonado</th>
                    <th className={`${th} text-right`}>Saldo</th>
                    <th className={`${th} text-right`}>Antigüedad</th>
                    <th className={`${th} text-right`}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No hay ventas con saldo pendiente</td></tr>
                  )}
                  {ventas.slice((page - 1) * perPage, page * perPage).map(v => (
                    <tr key={v.venta_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        {v.paciente_id
                          ? <Link to={`/pacientes/${v.paciente_id}`} className="font-medium hover:text-primary hover:underline">{v.paciente_nombre}</Link>
                          : <span className="font-medium">{v.paciente_nombre}</span>}
                        <Telefono tel={v.paciente_telefono} />
                      </td>
                      <td className="px-4 py-3"><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{v.venta_numero}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(v.fecha)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(v.total)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt(v.abonado)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(v.saldo)}</td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap ${v.dias > 90 ? "text-red-600" : v.dias > 30 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {v.dias === 0 ? "Hoy" : `hace ${v.dias} d`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" className="h-8" onClick={() => navigate(`/ventas/${v.venta_id}`)}>Cobrar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className={`${th} text-left`}>Paciente</th>
                    <th className={`${th} text-left`}>Crédito</th>
                    <th className={`${th} text-center`}>Cuota</th>
                    <th className={`${th} text-left`}>Vencimiento</th>
                    <th className={`${th} text-right`}>Vence</th>
                    <th className={`${th} text-right`}>Saldo</th>
                    <th className={`${th} text-right`}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotas.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No hay cuotas pendientes</td></tr>
                  )}
                  {cuotas.slice((page - 1) * perPage, page * perPage).map(c => {
                    const vencida = c.dias_vencido > 0
                    return (
                      <tr key={c.cuota_id} className={`border-b last:border-0 transition-colors ${vencida ? "bg-red-50 dark:bg-red-950/20 hover:bg-red-100/70" : "hover:bg-muted/30"}`}>
                        <td className="px-4 py-3">
                          <Link to={`/pacientes/${c.paciente_id}`} className="font-medium hover:text-primary hover:underline">{c.paciente_nombre}</Link>
                          <Telefono tel={c.paciente_telefono} />
                        </td>
                        <td className="px-4 py-3"><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{c.credito_numero}</span></td>
                        <td className="px-4 py-3 text-center">{c.cuota_numero} de {c.total_cuotas}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{fmtDate(c.fecha_vencimiento)}</td>
                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                          {vencida
                            ? <span className="text-red-600">Venció hace {c.dias_vencido} d</span>
                            : <span className="text-green-600">{c.dias_vencido === 0 ? "Hoy" : `En ${-c.dias_vencido} d`}</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(c.saldo)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" className="h-8" onClick={() => navigate(`/creditos?pagar=${c.credito_id}&cuota=${c.cuota_id}`)}>Cobrar</Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          <Paginador page={page} total={filas} perPage={perPage} onChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} />
        </div>
      )}
    </div>
  )
}
