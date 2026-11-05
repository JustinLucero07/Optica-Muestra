import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate, Link } from "react-router-dom"
import { toast } from "sonner"
import {
  Plus, Printer, Trash2, Search, FileText, Check, X, ShoppingCart, Copy, Pencil, Loader2, Receipt, Send,
} from "lucide-react"
import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { fmtMoney as fmt, fmtDate, hoyISO } from "@/lib/format"
import { estadoLabel } from "@/lib/estados"
import { PDF_BASE_CSS, getMarcaFooter, getMarcaLogo, openPrintWindow } from "@/lib/pdf"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Paginador } from "@/components/ui/Paginador"
import PacienteCombobox from "@/components/PacienteCombobox"
import ConfirmDialog from "@/components/ConfirmDialog"
import { useAuthStore } from "@/store/auth"
import { useBrandStore } from "@/store/brand"

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface ItemRow { descripcion: string; cantidad: number; precio_unitario: number; descuento: number; subtotal: number }
interface Presupuesto {
  id: number; numero: string; paciente_id: number | null; paciente_nombre: string | null
  fecha: string; estado: string; notas: string | null; total: number; validez_dias: number
  created_at: string; items: ItemRow[]
  venta_id: number | null; venta_numero: string | null
  orden_id: number | null; orden_numero: string | null
}
interface ItemForm { descripcion: string; cantidad: string; precio_unitario: string; descuento: string }

const ESTADO_COLOR: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  enviado: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  aceptado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rechazado: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  expirado: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  convertido: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
}
const FILTROS = ["", "borrador", "enviado", "aceptado", "convertido", "rechazado", "expirado"]
const ITEM_VACIO: ItemForm = { descripcion: "", cantidad: "1", precio_unitario: "", descuento: "0" }

/** Se puede convertir mientras no esté cerrado. */
const convertible = (p: Presupuesto) => !["convertido", "rechazado", "expirado"].includes(p.estado)

/** Días de validez que le quedan (negativo = vencido). */
function diasValidez(p: Presupuesto) {
  const vence = new Date(p.fecha + "T00:00:00")
  vence.setDate(vence.getDate() + p.validez_dias)
  return Math.ceil((vence.getTime() - new Date(hoyISO() + "T00:00:00").getTime()) / 86_400_000)
}

const subtotalItem = (it: ItemForm) => {
  const v = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0) * (1 - (parseFloat(it.descuento) || 0) / 100)
  return isNaN(v) ? 0 : v
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))

function EstadoChip({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ESTADO_COLOR[estado] ?? "bg-muted"}`}>
      {estadoLabel(estado)}
    </span>
  )
}

function Vencimiento({ p }: { p: Presupuesto }) {
  if (!convertible(p)) return <span className="text-muted-foreground/50">—</span>
  const d = diasValidez(p)
  const cls = d < 0 ? "text-red-600" : d <= 7 ? "text-amber-600" : "text-muted-foreground"
  return <span className={`text-xs whitespace-nowrap ${cls}`}>{d < 0 ? `Venció hace ${-d} d` : d === 0 ? "Vence hoy" : `En ${d} d`}</span>
}

// ── Impresión (mismo formato que el resto de documentos) ──────────────────────
function imprimir(p: Presupuesto) {
  const logo = useBrandStore.getState().logo
  const filas = p.items.map(it => `
    <tr><td>${esc(it.descripcion)}</td><td class="c">${it.cantidad}</td>
    <td class="r">${fmt(it.precio_unitario)}</td><td class="c">${it.descuento ? it.descuento + "%" : "—"}</td>
    <td class="r"><strong>${fmt(it.subtotal)}</strong></td></tr>`).join("")
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Presupuesto ${esc(p.numero)}</title>
<style>${PDF_BASE_CSS} td.r,th.r{text-align:right} td.c,th.c{text-align:center}</style></head><body>
<div class="doc-hdr">
  <div class="doc-hdr-left">${getMarcaLogo(logo)}<div class="doc-hdr-title">Presupuesto</div></div>
  <div class="doc-hdr-right"><div class="num">${esc(p.numero)}</div><div class="fecha">${fmtDate(p.fecha)}</div></div>
</div>
<div class="doc-body">
  <div class="doc-section">
    <div class="doc-section-title">Cliente</div>
    <div class="doc-grid">
      <span class="lbl">Nombre</span><span class="val"><strong>${esc(p.paciente_nombre ?? "—")}</strong></span>
      <span class="lbl">Validez</span><span class="val">${p.validez_dias} días desde la fecha de emisión</span>
    </div>
  </div>
  <table class="items"><thead><tr><th>Descripción</th><th class="c">Cant.</th><th class="r">Precio</th><th class="c">Desc.</th><th class="r">Subtotal</th></tr></thead>
  <tbody>${filas}</tbody></table>
  <div class="totales"><div class="t-row big"><span>TOTAL</span><span>${fmt(p.total)}</span></div></div>
  ${p.notas ? `<div class="doc-section"><div class="doc-section-title">Observaciones</div><p style="font-size:11px;white-space:pre-line">${esc(p.notas)}</p></div>` : ""}
</div>
${getMarcaFooter(logo)}
<script>window.onload=()=>window.print()</script></body></html>`
  openPrintWindow(html, 760, 960)
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function Presupuestos() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const rol = useAuthStore(s => s.user?.role)

  const [filtro, setFiltro] = useState("")
  const [busq, setBusq] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [verId, setVerId] = useState<number | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<Presupuesto | null>(null)

  // Formulario (crear / editar)
  const [form, setForm] = useState<{ abierto: boolean; editId: number | null }>({ abierto: false, editId: null })
  const [pacienteId, setPacienteId] = useState("")
  const [fecha, setFecha] = useState(hoyISO())
  const [validez, setValidez] = useState("30")
  const [notas, setNotas] = useState("")
  const [items, setItems] = useState<ItemForm[]>([{ ...ITEM_VACIO }])

  const { data: presupuestos = [], isLoading } = useQuery<Presupuesto[]>({
    queryKey: ["presupuestos"],
    queryFn: () => api.get("/presupuestos", { params: { limit: 2000 } }).then(r => r.data),
  })
  const ver = presupuestos.find(p => p.id === verId) ?? null

  const invalidar = () => qc.invalidateQueries({ queryKey: ["presupuestos"] })

  const guardarMut = useMutation({
    mutationFn: (data: object) => form.editId ? api.put(`/presupuestos/${form.editId}`, data) : api.post("/presupuestos", data),
    onSuccess: (r) => {
      toast.success(form.editId ? "Presupuesto actualizado" : `Presupuesto ${r.data.numero} creado`)
      invalidar(); cerrarForm(); setVerId(r.data.id)
    },
    onError: e => toast.error(errMsg(e, "No se pudo guardar el presupuesto")),
  })
  const estadoMut = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) => api.patch(`/presupuestos/${id}/estado`, null, { params: { estado } }),
    onSuccess: (_, v) => { invalidar(); toast.success(`Marcado como ${estadoLabel(v.estado).toLowerCase()}`) },
    onError: e => toast.error(errMsg(e, "No se pudo cambiar el estado")),
  })
  const eliminarMut = useMutation({
    mutationFn: (id: number) => api.delete(`/presupuestos/${id}`),
    onSuccess: () => { toast.success("Presupuesto eliminado"); invalidar(); setVerId(null) },
    onError: e => toast.error(errMsg(e, "No se pudo eliminar")),
  })
  const duplicarMut = useMutation({
    mutationFn: (p: Presupuesto) => api.post("/presupuestos", {
      paciente_id: p.paciente_id, fecha: hoyISO(), notas: p.notas, validez_dias: p.validez_dias,
      items: p.items.map(({ descripcion, cantidad, precio_unitario, descuento }) => ({ descripcion, cantidad, precio_unitario, descuento })),
    }),
    onSuccess: (r) => { toast.success(`Copia creada: ${r.data.numero}`); invalidar(); setVerId(r.data.id) },
    onError: e => toast.error(errMsg(e, "No se pudo duplicar")),
  })

  function abrirNuevo() {
    setPacienteId(""); setFecha(hoyISO()); setValidez("30"); setNotas(""); setItems([{ ...ITEM_VACIO }])
    setForm({ abierto: true, editId: null })
  }
  function abrirEditar(p: Presupuesto) {
    setPacienteId(p.paciente_id ? String(p.paciente_id) : ""); setFecha(p.fecha); setValidez(String(p.validez_dias)); setNotas(p.notas ?? "")
    setItems(p.items.map(it => ({ descripcion: it.descripcion, cantidad: String(it.cantidad), precio_unitario: String(it.precio_unitario), descuento: String(it.descuento) })))
    setVerId(null); setForm({ abierto: true, editId: p.id })
  }
  function cerrarForm() { setForm({ abierto: false, editId: null }) }

  const setItem = (i: number, campo: keyof ItemForm, v: string) => setItems(prev => prev.map((it, k) => k === i ? { ...it, [campo]: v } : it))
  const totalForm = items.reduce((s, it) => s + subtotalItem(it), 0)

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    const validos = items.filter(it => it.descripcion.trim() && it.precio_unitario)
    if (!validos.length) { toast.error("Agrega al menos un ítem con descripción y precio"); return }
    guardarMut.mutate({
      paciente_id: pacienteId ? Number(pacienteId) : null, fecha, notas: notas || null, validez_dias: parseInt(validez) || 30,
      items: validos.map(it => ({
        descripcion: it.descripcion.trim(), cantidad: parseFloat(it.cantidad) || 1,
        precio_unitario: parseFloat(it.precio_unitario), descuento: parseFloat(it.descuento) || 0,
      })),
    })
  }

  function convertirAVenta(p: Presupuesto) { navigate("/ventas/nueva", { state: { presupuesto: p } }) }
  function convertirAOrden(p: Presupuesto) {
    navigate("/ordenes", { state: { fromPresupuesto: {
      id: p.id, numero: p.numero, paciente_id: p.paciente_id, items: p.items, notas: `Basado en presupuesto ${p.numero}`,
    } } })
  }

  const q = busq.trim().toLowerCase()
  const filtrados = presupuestos.filter(p =>
    (!filtro || p.estado === filtro) &&
    (!q || p.numero.toLowerCase().includes(q) || (p.paciente_nombre?.toLowerCase().includes(q) ?? false)))
  const abiertos = presupuestos.filter(convertible)
  const pagina = filtrados.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="p-3 sm:p-6 space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6" /> Presupuestos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cotizaciones para tus pacientes. Cuando aceptan, conviértelas en venta u orden de laboratorio.
            {abiertos.length > 0 && <> · <strong className="text-foreground">{abiertos.length}</strong> abiertos por {fmt(abiertos.reduce((s, p) => s + p.total, 0))}</>}
          </p>
        </div>
        <Button onClick={abrirNuevo}><Plus className="h-4 w-4 mr-1" /> Nuevo presupuesto</Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 rounded-xl" placeholder="Buscar por N° o paciente…" value={busq} onChange={e => { setBusq(e.target.value); setPage(1) }} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTROS.map(est => (
            <button key={est || "todos"} type="button" onClick={() => { setFiltro(est); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${filtro === est ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"}`}>
              {est ? estadoLabel(est) : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Cargando…</div>
        ) : filtrados.length === 0 ? (
          <EmptyState icon={FileText} title={busq || filtro ? "Sin resultados" : "Todavía no hay presupuestos"}
            description={busq || filtro ? "Prueba con otro filtro" : "Crea el primero con «Nuevo presupuesto»"} />
        ) : (
          <>
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-4 py-3">N°</th>
                  <th className="text-left px-4 py-3">Paciente</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Validez</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {pagina.map(p => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setVerId(p.id)}>
                    <td className="px-4 py-3 font-mono text-xs font-medium whitespace-nowrap">{p.numero}</td>
                    <td className="px-4 py-3 font-medium">{p.paciente_nombre ?? <span className="text-muted-foreground font-normal">Sin paciente</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(p.fecha)}</td>
                    <td className="px-4 py-3"><Vencimiento p={p} /></td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(p.total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <EstadoChip estado={p.estado} />
                        {(p.venta_numero || p.orden_numero) && <span className="text-xs text-emerald-700 dark:text-emerald-400">→ {p.venta_numero ?? p.orden_numero}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {convertible(p) && (
                          <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => convertirAVenta(p)}>
                            <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Vender
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Imprimir" onClick={() => imprimir(p)}><Printer className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="md:hidden divide-y">
              {pagina.map(p => (
                <li key={p.id} className="p-4 space-y-2 cursor-pointer" onClick={() => setVerId(p.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.paciente_nombre ?? "Sin paciente"}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-mono">{p.numero}</span> · {fmtDate(p.fecha)}</p>
                    </div>
                    <span className="font-semibold tabular-nums">{fmt(p.total)}</span>
                  </div>
                  <div className="flex items-center gap-2"><EstadoChip estado={p.estado} /><Vencimiento p={p} /></div>
                </li>
              ))}
            </ul>
            <Paginador page={page} total={filtrados.length} perPage={perPage} onChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} />
          </>
        )}
      </div>

      {/* ── Detalle ── */}
      {ver && (
        <Dialog open onClose={() => setVerId(null)} className="max-w-2xl">
          <DialogHeader onClose={() => setVerId(null)}>
            <span className="flex items-center gap-2 flex-wrap">Presupuesto {ver.numero} <EstadoChip estado={ver.estado} /></span>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Paciente</p>
                {ver.paciente_id ? <Link to={`/pacientes/${ver.paciente_id}`} className="font-medium hover:text-primary hover:underline">{ver.paciente_nombre}</Link> : <p className="font-medium">Sin paciente</p>}
              </div>
              <div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-medium">{fmtDate(ver.fecha)}</p></div>
              <div><p className="text-xs text-muted-foreground">Validez</p><p className="font-medium">{ver.validez_dias} días · <Vencimiento p={ver} /></p></div>
            </div>

            {ver.estado === "convertido" && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2 flex-wrap">
                <Check className="h-4 w-4" /> Convertido en
                {ver.venta_id && <Link className="underline font-medium" to={`/ventas/${ver.venta_id}`}>venta {ver.venta_numero}</Link>}
                {ver.orden_id && <Link className="underline font-medium" to="/ordenes">orden {ver.orden_numero}</Link>}
              </div>
            )}

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr><th className="text-left px-3 py-2">Descripción</th><th className="text-right px-3 py-2">Cant.</th><th className="text-right px-3 py-2">Precio</th><th className="text-right px-3 py-2">Desc.</th><th className="text-right px-3 py-2">Subtotal</th></tr>
                </thead>
                <tbody className="divide-y">
                  {ver.items.map((it, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{it.descripcion}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{it.cantidad}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(it.precio_unitario)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{it.descuento ? `${it.descuento}%` : "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-muted/30"><td colSpan={4} className="px-3 py-2 text-right font-semibold">Total</td><td className="px-3 py-2 text-right text-lg font-bold text-primary tabular-nums">{fmt(ver.total)}</td></tr></tfoot>
              </table>
            </div>
            {ver.notas && <p className="text-sm text-muted-foreground whitespace-pre-line"><span className="font-medium text-foreground">Notas:</span> {ver.notas}</p>}

            {ver.estado !== "convertido" && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Estado</p>
                <div className="flex flex-wrap gap-2">
                  {([["enviado", Send], ["aceptado", Check], ["rechazado", X]] as const).map(([est, Icon]) => (
                    <Button key={est} size="sm" variant="outline" disabled={ver.estado === est || estadoMut.isPending}
                      onClick={() => estadoMut.mutate({ id: ver.id, estado: est })}>
                      <Icon className="h-3.5 w-3.5 mr-1" /> {estadoLabel(est)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            {rol === "admin" && (
              <Button variant="ghost" className="text-destructive hover:text-destructive mr-auto" onClick={() => setConfirmEliminar(ver)}>
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            )}
            <Button variant="outline" onClick={() => imprimir(ver)}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
            <Button variant="outline" onClick={() => duplicarMut.mutate(ver)} disabled={duplicarMut.isPending}><Copy className="h-4 w-4 mr-1" /> Duplicar</Button>
            {ver.estado !== "convertido" && <Button variant="outline" onClick={() => abrirEditar(ver)}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>}
            {convertible(ver) && (
              <>
                <Button variant="outline" onClick={() => convertirAOrden(ver)}><FileText className="h-4 w-4 mr-1" /> Crear orden lab</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => convertirAVenta(ver)}><ShoppingCart className="h-4 w-4 mr-1" /> Convertir a venta</Button>
              </>
            )}
          </DialogFooter>
        </Dialog>
      )}

      {/* ── Formulario ── */}
      {form.abierto && (
        <Dialog open onClose={cerrarForm} className="max-w-3xl">
          <form onSubmit={guardar}>
            <DialogHeader onClose={cerrarForm}>{form.editId ? "Editar presupuesto" : "Nuevo presupuesto"}</DialogHeader>
            <DialogBody className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_120px] gap-3">
                <div className="space-y-1.5 min-w-0">
                  <Label>Paciente <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <PacienteCombobox value={pacienteId} onChange={id => setPacienteId(id)} />
                </div>
                <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Validez (días)</Label><Input type="number" min="1" value={validez} onChange={e => setValidez(e.target.value)} /></div>
              </div>

              <div className="space-y-2">
                <div className="hidden sm:grid grid-cols-[1fr_80px_110px_70px_100px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span>Descripción</span><span>Cant.</span><span>Precio</span><span>Desc. %</span><span className="text-right">Subtotal</span><span />
                </div>
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px] sm:grid-cols-[1fr_80px_110px_70px_100px_32px] gap-2 items-center rounded-lg sm:rounded-none border sm:border-0 p-2 sm:p-0">
                    <Input placeholder="Ej: Armazón acetato" value={it.descripcion} onChange={e => setItem(i, "descripcion", e.target.value)} className="col-span-2 sm:col-span-1" />
                    <Input type="number" min="0.01" step="0.01" value={it.cantidad} onChange={e => setItem(i, "cantidad", e.target.value)} aria-label="Cantidad" />
                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={it.precio_unitario} onChange={e => setItem(i, "precio_unitario", e.target.value)} aria-label="Precio" />
                    <Input type="number" min="0" max="100" step="1" value={it.descuento} onChange={e => setItem(i, "descuento", e.target.value)} aria-label="Descuento %" />
                    <span className="text-right font-semibold tabular-nums text-sm">{fmt(subtotalItem(it))}</span>
                    <button type="button" title="Quitar ítem" disabled={items.length === 1}
                      onClick={() => setItems(prev => prev.filter((_, k) => k !== i))}
                      className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive disabled:opacity-30">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, { ...ITEM_VACIO }])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Agregar ítem
                  </Button>
                  <p className="text-lg font-bold">Total: <span className="text-primary tabular-nums">{fmt(totalForm)}</span></p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notas <span className="text-muted-foreground font-normal">(salen impresas)</span></Label>
                <Input placeholder="Condiciones, tiempo de entrega, etc." value={notas} onChange={e => setNotas(e.target.value)} />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={cerrarForm}>Cancelar</Button>
              <Button type="submit" disabled={guardarMut.isPending}>
                {guardarMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {form.editId ? "Guardar cambios" : "Crear presupuesto"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!confirmEliminar}
        title={`¿Eliminar el presupuesto ${confirmEliminar?.numero}?`}
        description="Esta acción no se puede deshacer."
        destructive
        confirmLabel="Eliminar"
        onConfirm={() => { if (confirmEliminar) eliminarMut.mutate(confirmEliminar.id); setConfirmEliminar(null) }}
        onCancel={() => setConfirmEliminar(null)}
      />
    </div>
  )
}
