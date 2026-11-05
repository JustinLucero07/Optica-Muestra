import { useMemo, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  FileX, ShoppingCart, Loader2, CheckCircle, AlertCircle, Pencil, Zap, ExternalLink,
  Search, FileText, Clock, X,
} from "lucide-react"
import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { fmtMoney, fmtDate } from "@/lib/format"
import { cuentasParaMetodo, cuentaPorDefecto, METODOS_PAGO, metodoLabel, type CuentaLite } from "@/lib/metodosCuenta"
import { useAuthStore } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"

interface OrdenSF {
  id: number
  numero: string
  paciente_id: number
  paciente_nombre: string | null
  tipo: string
  estado: string
  fecha_envio: string
  armazon_ref: string | null
  precio_armazon: number | string | null
  precio_lunas: number | string | null
  precio_venta: number | string | null
}

type Filtro = "todas" | "con_precio" | "sin_precio"

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente", enviado: "Enviado", en_proceso: "En proceso",
  listo: "Listo", entregado: "Entregado", rechazado: "Rechazado",
}
const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  enviado: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  en_proceso: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  listo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  entregado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  rechazado: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300",
}

const num = (v: unknown) => Number(v) || 0
const tienePrecio = (o: OrdenSF) => num(o.precio_venta) > 0

/** Días desde el envío de la orden (para resaltar las que llevan mucho sin venta). */
function diasDesde(fecha: string) {
  const d = new Date(fecha.slice(0, 10) + "T00:00:00")
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
}

export default function OrdenesSinVenta() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const rol = useAuthStore(s => s.user?.role)
  const puedeFacturar = rol === "admin" || rol === "vendedor"

  const [filtro, setFiltro] = useState<Filtro>("todas")
  const [busq, setBusq] = useState("")

  // Modal editar precios
  const [editando, setEditando] = useState<OrdenSF | null>(null)
  const [editArmazon, setEditArmazon] = useState("")
  const [editLunas, setEditLunas] = useState("")

  // Modal facturar
  const [facturando, setFacturando] = useState<OrdenSF | null>(null)
  const [metodoPago, setMetodoPago] = useState("efectivo")
  const [registrarCobro, setRegistrarCobro] = useState(true)
  const [cuentaId, setCuentaId] = useState("")
  const [ventaCreada, setVentaCreada] = useState<{ id: number; numero: string; cobro: string | null } | null>(null)

  // El backend ya filtra "sin venta y no rechazada" y trae el nombre del paciente.
  const { data: ordenes = [], isLoading } = useQuery<OrdenSF[]>({
    queryKey: ["ordenes-sin-venta"],
    queryFn: () => api.get("/ordenes", { params: { sin_venta: true, limit: 500 } }).then(r => r.data),
    staleTime: 30_000,
  })

  const { data: cuentas = [] } = useQuery<CuentaLite[]>({
    queryKey: ["cuentas-bancarias"],
    queryFn: () => api.get("/cuentas-bancarias").then(r => r.data),
    staleTime: 300_000,
  })

  const cuentasValidas = useMemo(() => cuentasParaMetodo(cuentas, metodoPago, true), [cuentas, metodoPago])

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["ordenes-sin-venta"] })
    qc.invalidateQueries({ queryKey: ["nav-badge-sin-venta"] })
    qc.invalidateQueries({ queryKey: ["ordenes"] })
  }

  // ── Editar precios ──────────────────────────────────────────────────────────
  function abrirEditPrecios(o: OrdenSF) {
    setEditando(o)
    setEditArmazon(num(o.precio_armazon) > 0 ? num(o.precio_armazon).toFixed(2) : "")
    setEditLunas(num(o.precio_lunas) > 0 ? num(o.precio_lunas).toFixed(2) : "")
  }
  const totalEdit = (parseFloat(editArmazon) || 0) + (parseFloat(editLunas) || 0)

  const preciosMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => api.put(`/ordenes/${id}`, data),
    onSuccess: () => { invalidar(); toast.success("Precios guardados"); setEditando(null) },
    onError: (e) => toast.error(errMsg(e, "Error al guardar precios")),
  })

  function guardarPrecios() {
    if (!editando) return
    const armazon = parseFloat(editArmazon) || 0
    const lunas = parseFloat(editLunas) || 0
    if (armazon + lunas <= 0) { toast.error("Ingresa al menos un precio mayor a 0"); return }
    preciosMut.mutate({
      id: editando.id,
      data: { precio_armazon: armazon > 0 ? armazon : null, precio_lunas: lunas > 0 ? lunas : null, precio_venta: armazon + lunas },
    })
  }

  // ── Facturar (una sola llamada: venta + vínculo + cobro, todo o nada) ──────
  function abrirFacturar(o: OrdenSF) {
    setFacturando(o)
    setMetodoPago("efectivo")
    setRegistrarCobro(true)
    setCuentaId(cuentaPorDefecto(cuentas, "efectivo", true)?.id.toString() ?? "")
    setVentaCreada(null)
  }

  function cambiarMetodo(m: string) {
    setMetodoPago(m)
    setCuentaId(cuentaPorDefecto(cuentas, m, true)?.id.toString() ?? "")
  }

  const facturarMut = useMutation({
    mutationFn: (o: OrdenSF) => api.post(`/ordenes/${o.id}/facturar`, {
      cobro: registrarCobro && cuentaId ? { cuenta_bancaria_id: Number(cuentaId), metodo_pago: metodoPago } : null,
    }).then(r => r.data as { venta_id: number; venta_numero: string; cobro_numero: string | null }),
    onSuccess: (r) => {
      invalidar()
      qc.invalidateQueries({ queryKey: ["ventas"] })
      qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] })
      setVentaCreada({ id: r.venta_id, numero: r.venta_numero, cobro: r.cobro_numero })
    },
    onError: (e) => toast.error(errMsg(e, "No se pudo registrar la venta")),
  })


  function irANuevaVenta(o: OrdenSF) {
    navigate("/ventas/nueva", { state: { orden: o, paciente_id: o.paciente_id } })
  }

  // ── Datos derivados ─────────────────────────────────────────────────────────
  const conPrecio = ordenes.filter(tienePrecio)
  const sinPrecioL = ordenes.filter(o => !tienePrecio(o))
  const suma = (l: OrdenSF[]) => l.reduce((s, o) => s + num(o.precio_venta), 0)
  const sinPrecio = sinPrecioL.length

  const filtradas = ordenes.filter(o => {
    if (filtro === "con_precio" && !tienePrecio(o)) return false
    if (filtro === "sin_precio" && tienePrecio(o)) return false
    if (!busq) return true
    const q = busq.toLowerCase()
    return [o.numero, o.paciente_nombre, o.tipo, o.armazon_ref].some(v => v?.toLowerCase().includes(q))
  })

  const kpis: { key: Filtro; label: string; count: number; monto: number | null; icon: typeof Clock; activo: string; texto: string }[] = [
    { key: "todas", label: "Sin venta", count: ordenes.length, monto: suma(ordenes), icon: FileX,
      activo: "border-primary bg-primary/5 ring-1 ring-primary/30", texto: "text-primary" },
    { key: "con_precio", label: "Listas para cobrar", count: conPrecio.length, monto: suma(conPrecio), icon: Zap,
      activo: "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300/40 dark:bg-emerald-950/20", texto: "text-emerald-600 dark:text-emerald-400" },
    { key: "sin_precio", label: "Falta el precio", count: sinPrecioL.length, monto: null, icon: AlertCircle,
      activo: "border-amber-400 bg-amber-50 ring-1 ring-amber-300/40 dark:bg-amber-950/20", texto: "text-amber-600 dark:text-amber-400" },
  ]

  // ── Piezas reutilizadas por la tabla (escritorio) y las tarjetas (móvil) ────
  const EstadoChip = ({ o }: { o: OrdenSF }) => (
    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ESTADO_COLOR[o.estado] ?? ESTADO_COLOR.pendiente}`}>
      {ESTADO_LABEL[o.estado] ?? o.estado}
    </span>
  )
  const Total = ({ o }: { o: OrdenSF }) => tienePrecio(o)
    ? <span className="font-semibold text-primary tabular-nums">{fmtMoney(o.precio_venta)}</span>
    : <button type="button" onClick={() => abrirEditPrecios(o)}
        className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium whitespace-nowrap hover:underline">
        <AlertCircle className="h-3.5 w-3.5" /> Poner precio
      </button>

  const Acciones = ({ o, nowrap }: { o: OrdenSF; nowrap?: boolean }) => (
    <div className={`flex items-center justify-end gap-1.5 ${nowrap ? "flex-nowrap" : "flex-wrap"}`}>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Editar precios" onClick={() => abrirEditPrecios(o)}>
        <Pencil className="h-4 w-4" />
      </Button>
      {puedeFacturar && (tienePrecio(o) ? (
        <Button size="sm" className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => abrirFacturar(o)}>
          <Zap className="h-3.5 w-3.5 mr-1" /> Registrar venta
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => irANuevaVenta(o)} title="Armar la venta a mano">
          <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Nueva venta
        </Button>
      ))}
    </div>
  )

  const Antiguedad = ({ o }: { o: OrdenSF }) => {
    const d = diasDesde(o.fecha_envio)
    if (d < 7) return null
    return <span className={`text-[11px] ${d >= 30 ? "text-red-500" : "text-amber-600"}`}>hace {d} días</span>
  }

  return (
    <div className="p-3 sm:p-6 space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileX className="h-6 w-6 text-orange-500" />
            Órdenes sin venta
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Lentes que ya se mandaron a hacer pero todavía no se registraron como venta.
            Regístralas aquí para que el cobro y la caja cuadren. ¿Solo es una cotización? Usa <Link to="/presupuestos" className="text-primary hover:underline">Presupuestos</Link>.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/ordenes"><FileText className="h-4 w-4 mr-2" /> Ir a órdenes</Link>
        </Button>
      </div>

      {/* KPIs (también filtran) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {kpis.map(({ key, label, count, monto, icon: Icon, activo, texto }) => {
          const sel = filtro === key
          return (
            <button
              type="button"
              key={key}
              onClick={() => setFiltro(key)}
              aria-pressed={sel}
              className={`text-left rounded-2xl p-3 sm:p-4 border-2 transition-all flex items-center gap-4 ${sel ? activo : "border-border bg-card hover:bg-muted/40"}`}
            >
              <div className={`hidden sm:flex h-11 w-11 rounded-xl items-center justify-center shrink-0 bg-muted ${sel ? texto : "text-muted-foreground"}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{label}</p>
                <p className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                  <span className={`text-2xl font-bold tabular-nums ${sel ? texto : ""}`}>{count}</span>
                  {monto != null && <span className="text-xs sm:text-sm font-medium text-muted-foreground tabular-nums">{fmtMoney(monto)}</span>}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Búsqueda + aviso */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 pr-9 rounded-xl" placeholder="Buscar por número, paciente, tipo o armazón…"
            value={busq} onChange={e => setBusq(e.target.value)} />
          {busq && (
            <button type="button" onClick={() => setBusq("")} title="Limpiar"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {sinPrecio > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5" />
            {sinPrecio === 1 ? "1 orden no tiene precio" : `${sinPrecio} órdenes no tienen precio`} — pónselo para registrar la venta en un clic.
          </p>
        )}
      </div>

      {/* Lista */}
      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
          </div>
        ) : filtradas.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title={busq ? "Sin resultados" : "Todo al día"}
            description={busq ? "Ninguna orden coincide con la búsqueda" : "Todas las órdenes de laboratorio tienen su venta registrada"}
          />
        ) : (
          <>
            {/* Escritorio: tabla a todo el ancho */}
            <table className="hidden lg:table w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-4 py-3 w-[110px]">N°</th>
                  <th className="text-left px-4 py-3">Paciente</th>
                  <th className="text-left px-4 py-3">Lente</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Envío</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Estado lab</th>
                  <th className="text-right px-4 py-3">Armazón</th>
                  <th className="text-right px-4 py-3">Lunas</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtradas.map(o => (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-xs whitespace-nowrap">{o.numero}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/pacientes/${o.paciente_id}`} className="hover:text-primary hover:underline">
                        {o.paciente_nombre ?? `Paciente #${o.paciente_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{o.tipo}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">{fmtDate(o.fecha_envio)}</span>
                        <Antiguedad o={o} />
                      </div>
                    </td>
                    <td className="px-4 py-3"><EstadoChip o={o} /></td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{num(o.precio_armazon) > 0 ? fmtMoney(o.precio_armazon) : <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{num(o.precio_lunas) > 0 ? fmtMoney(o.precio_lunas) : <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap"><Total o={o} /></td>
                    <td className="px-4 py-3"><Acciones o={o} nowrap /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tablet / móvil: tarjetas */}
            <ul className="lg:hidden divide-y divide-border/60">
              {filtradas.map(o => (
                <li key={o.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{o.paciente_nombre ?? `Paciente #${o.paciente_id}`}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{o.numero}</span> · {o.tipo} · {fmtDate(o.fecha_envio)}
                      </p>
                    </div>
                    <div className="text-right shrink-0"><Total o={o} /></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <EstadoChip o={o} />
                    <Antiguedad o={o} />
                  </div>
                  <Acciones o={o} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ── Modal editar precios ── */}
      {editando && (
        <Dialog open onClose={() => setEditando(null)} className="max-w-sm">
          <DialogHeader onClose={() => setEditando(null)}>Precios — {editando.numero}</DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-sm text-muted-foreground">{editando.tipo} · {editando.paciente_nombre}</p>
            {editando.armazon_ref && (
              <p className="text-xs text-muted-foreground">Armazón ref: <strong>{editando.armazon_ref}</strong></p>
            )}
            {[
              { label: "Precio armazón", val: editArmazon, set: setEditArmazon },
              { label: "Precio lunas", val: editLunas, set: setEditLunas },
            ].map(({ label, val, set }) => (
              <div key={label} className="space-y-1.5">
                <Label>{label}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" className="pl-6" value={val}
                    onChange={e => set(e.target.value)} onKeyDown={e => e.key === "Enter" && guardarPrecios()} />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-primary tabular-nums">{fmtMoney(totalEdit)}</span>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={guardarPrecios} disabled={preciosMut.isPending || totalEdit <= 0}>
              {preciosMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* ── Modal facturar ── */}
      {facturando && (
        <Dialog open onClose={() => setFacturando(null)} className="max-w-md">
          <DialogHeader onClose={() => setFacturando(null)}>
            {ventaCreada ? "Venta registrada" : `Registrar venta — ${facturando.numero}`}
          </DialogHeader>
          <DialogBody className="space-y-4">
            {ventaCreada ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
                <p className="font-semibold text-lg">Venta {ventaCreada.numero} generada</p>
                <p className="text-sm text-muted-foreground">
                  La orden quedó vinculada{ventaCreada.cobro ? ` y se registró el cobro ${ventaCreada.cobro}` : " (sin cobro: queda como saldo pendiente)"}.
                </p>
                <Link to={`/ventas/${ventaCreada.id}`} className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  onClick={() => setFacturando(null)}>
                  <ExternalLink className="h-3.5 w-3.5" /> Ver detalle de la venta
                </Link>
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Paciente</span>
                    <span className="font-medium text-right">{facturando.paciente_nombre}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Tipo</span>
                    <span>{facturando.tipo}</span>
                  </div>
                  {num(facturando.precio_armazon) > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Armazón</span><span className="tabular-nums">{fmtMoney(facturando.precio_armazon)}</span></div>
                  )}
                  {num(facturando.precio_lunas) > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Lunas</span><span className="tabular-nums">{fmtMoney(facturando.precio_lunas)}</span></div>
                  )}
                  <div className="flex justify-between border-t border-border/50 pt-1.5 font-bold">
                    <span>Total</span>
                    <span className="text-primary tabular-nums">{fmtMoney(facturando.precio_venta)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" className="h-4 w-4 rounded" checked={registrarCobro}
                      onChange={e => setRegistrarCobro(e.target.checked)} />
                    <span className="text-sm font-medium">El cliente paga ahora (registrar cobro)</span>
                  </label>
                  {registrarCobro && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <Label className="text-xs">Método de pago</Label>
                        <select className="w-full px-3" value={metodoPago} onChange={e => cambiarMetodo(e.target.value)}>
                          {METODOS_PAGO.map(m => <option key={m} value={m}>{metodoLabel(m)}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <Label className="text-xs">Cuenta</Label>
                        <select className="w-full px-3" value={cuentaId} onChange={e => setCuentaId(e.target.value)}>
                          {cuentasValidas.length === 0 && <option value="">Sin cuentas para este método</option>}
                          {cuentasValidas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            {ventaCreada ? (
              <Button onClick={() => setFacturando(null)}>Cerrar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setFacturando(null)}>Cancelar</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => facturarMut.mutate(facturando)}
                  disabled={facturarMut.isPending || (registrarCobro && !cuentaId)}>
                  {facturarMut.isPending
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando…</>
                    : <><Zap className="h-4 w-4 mr-2" /> {registrarCobro ? "Crear venta y cobrar" : "Crear venta"}</>}
                </Button>
              </>
            )}
          </DialogFooter>
        </Dialog>
      )}
    </div>
  )
}
