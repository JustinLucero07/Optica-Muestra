import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { History, Loader2, Search, X } from "lucide-react"
import { api } from "@/lib/api"
import { fmtDate } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Paginador } from "@/components/ui/Paginador"

interface Registro {
  id: number; fecha: string; usuario_id: number | null; usuario_nombre: string
  accion: string; entidad: string; entidad_id: number | null; referencia: string | null; detalle: string | null
}
interface Usuario { id: number; full_name: string }

const ACCION: Record<string, { texto: string; color: string }> = {
  anular: { texto: "Anuló", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  eliminar: { texto: "Eliminó", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  desactivar: { texto: "Desactivó", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  editar: { texto: "Editó", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  ajustar_stock: { texto: "Ajustó stock", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  crear: { texto: "Creó", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cerrar: { texto: "Cerró", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  cambiar_password: { texto: "Cambió su contraseña", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
}
const ENTIDAD: Record<string, string> = {
  venta: "Venta", cobro: "Cobro", egreso: "Egreso", cuenta_por_pagar: "Cuenta por pagar", credito: "Crédito",
  producto: "Producto", caja: "Caja", configuracion: "Configuración", usuario: "Usuario", orden: "Orden",
  presupuesto: "Presupuesto", cuenta_bancaria: "Cuenta bancaria",
}

export default function Auditoria() {
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [usuarioId, setUsuarioId] = useState("")
  const [entidad, setEntidad] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)

  const { data, isLoading } = useQuery<{ total: number; items: Registro[] }>({
    queryKey: ["auditoria", desde, hasta, usuarioId, entidad, q, page, perPage],
    queryFn: () => api.get("/auditoria", { params: {
      desde: desde || undefined, hasta: hasta || undefined, usuario_id: usuarioId || undefined,
      entidad: entidad || undefined, q: q || undefined, skip: (page - 1) * perPage, limit: perPage,
    } }).then(r => r.data),
    placeholderData: prev => prev,
  })
  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ["personal"], queryFn: () => api.get("/auth/users").then(r => r.data), staleTime: 300_000,
  })

  const hayFiltros = desde || hasta || usuarioId || entidad || q
  const limpiar = () => { setDesde(""); setHasta(""); setUsuarioId(""); setEntidad(""); setQ(""); setPage(1) }
  const items = data?.items ?? []

  return (
    <div className="p-3 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><History className="h-6 w-6" /> Historial de cambios</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Quién anuló, eliminó o modificó algo importante (ventas, cobros, precios, stock, caja, usuarios) y cuándo.
          Este registro no se puede borrar desde el sistema.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar N°, producto, detalle…" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} />
        </div>
        <select className="w-full sm:w-48 px-3" value={usuarioId} onChange={e => { setUsuarioId(e.target.value); setPage(1) }} aria-label="Usuario">
          <option value="">Todos los usuarios</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <select className="w-full sm:w-48 px-3" value={entidad} onChange={e => { setEntidad(e.target.value); setPage(1) }} aria-label="Tipo">
          <option value="">Todo</option>
          {Object.entries(ENTIDAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">Desde
          <Input type="date" className="w-40" value={desde} onChange={e => { setDesde(e.target.value); setPage(1) }} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">Hasta
          <Input type="date" className="w-40" value={hasta} onChange={e => { setHasta(e.target.value); setPage(1) }} />
        </label>
        {hayFiltros && <Button variant="ghost" size="sm" onClick={limpiar}><X className="h-4 w-4 mr-1" /> Limpiar</Button>}
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Cargando…</div>
        ) : items.length === 0 ? (
          <EmptyState icon={History} title={hayFiltros ? "Sin resultados" : "Todavía no hay cambios registrados"}
            description={hayFiltros ? "Prueba con otros filtros" : "Aquí aparecerán las anulaciones, eliminaciones y cambios de precios o stock"} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Fecha y hora</th>
                    <th className="text-left px-4 py-3">Usuario</th>
                    <th className="text-left px-4 py-3">Acción</th>
                    <th className="text-left px-4 py-3">Sobre</th>
                    <th className="text-left px-4 py-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {items.map(r => {
                    const a = ACCION[r.accion] ?? { texto: r.accion, color: "bg-muted" }
                    return (
                      <tr key={r.id} className="hover:bg-muted/30 align-top">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {fmtDate(r.fecha)} <span className="text-muted-foreground">{r.fecha.slice(11, 16)}</span>
                        </td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{r.usuario_nombre}</td>
                        <td className="px-4 py-3"><span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${a.color}`}>{a.texto}</span></td>
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground">{ENTIDAD[r.entidad] ?? r.entidad}</span>
                          {r.referencia && <span className="ml-1.5 font-medium">{r.referencia}</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-md">{r.detalle ?? "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Paginador page={page} total={data?.total ?? 0} perPage={perPage} onChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} />
          </>
        )}
      </div>
    </div>
  )
}
