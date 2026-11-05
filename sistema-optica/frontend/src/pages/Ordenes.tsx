import { Paginador } from "@/components/ui/Paginador"
import { toast } from "sonner"
import { Plus, Loader2, Printer, ChevronDown, MessageCircle, Send, Trash2, Tag, LayoutGrid, List, Zap, ShoppingCart } from "lucide-react"
import { deleteWithUndo, confirmAction } from "@/lib/confirm"
import { enviarOrdenLista } from "@/lib/whatsapp"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fmtDate, fmtMoney, nombreMes } from "@/lib/format"
import { estadoLabel } from "@/lib/estados"
import { ESTADOS_ORDEN, ESTADO_BADGE_CLASS } from "@/pages/ordenes/tipos"
import { EstadoPill, EstadoDropdownPortal } from "@/pages/ordenes/componentes"
import { printOrden, printEtiqueta, printAceptacion, enviarAlLab } from "@/pages/ordenes/documentos"
import { useOrdenes } from "@/pages/ordenes/useOrdenes"
import OrdenFormDialog from "@/pages/ordenes/OrdenFormDialog"

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Ordenes() {
  const ctx = useOrdenes()
  const {
    navigate,
    filtroEstado,
    setFiltroEstado,
    filtroPaciente,
    setFiltroPaciente,
    mesOffset,
    irAMes,
    verTodoMes,
    vistaKanban,
    setVistaKanban,
    page,
    setPage,
    PER_PAGE,
    setPER_PAGE,
    rolUsuario,
    estadoDropdown,
    setEstadoDropdown,
    estadoAnchorRef,
    brandLogo,
    config,
    waCloudEnabled,
    isLoading,
    estadoMut,
    deleteMut,
    waApiMut,
    pacienteNombre,
    pacienteTelefono,
    openNew,
    openEdit,
    ordenesFiltradas,
  } = ctx

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Órdenes de laboratorio</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nueva orden</Button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="Buscar paciente..."
          className="w-56"
          value={filtroPaciente}
          onChange={e => setFiltroPaciente(e.target.value)}
        />
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filtroEstado}
          onChange={e => { setPage(1); setFiltroEstado(e.target.value) }}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_ORDEN.map(s => <option key={s} value={s}>{estadoLabel(s)}</option>)}
        </select>
        <div className="flex items-center gap-1 border rounded-md px-1">
          <button onClick={() => irAMes((isNaN(mesOffset) ? 0 : mesOffset) - 1)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-4 w-4 rotate-90" />
          </button>
          <span className="inline-block text-sm font-medium first-letter:uppercase px-1 min-w-[120px] text-center">
            {isNaN(mesOffset) ? "Todos los meses" : nombreMes(mesOffset)}
          </span>
          <button onClick={() => irAMes((isNaN(mesOffset) ? 0 : mesOffset) + 1)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-4 w-4 -rotate-90" />
          </button>
        </div>
        {mesOffset !== 0 && !isNaN(mesOffset) && (
          <Button variant="outline" size="sm" onClick={() => irAMes(0)}>Mes actual</Button>
        )}
        {!isNaN(mesOffset) && (
          <Button variant="ghost" size="sm" onClick={verTodoMes}>Ver todo</Button>
        )}
        <div className="ml-auto flex items-center gap-1 border rounded-md overflow-hidden">
          <button onClick={() => setVistaKanban(false)} title="Vista lista"
            className={`p-2 transition-colors ${!vistaKanban ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <List className="h-4 w-4" />
          </button>
          <button onClick={() => setVistaKanban(true)} title="Vista Kanban"
            className={`p-2 transition-colors ${vistaKanban ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : vistaKanban ? (
        /* ── Vista Kanban ── */
        <div className="flex gap-3 overflow-x-auto pb-4">
          {ESTADOS_ORDEN.map(estado => {
            const cols = ordenesFiltradas.filter(o => o.estado === estado)
            return (
              <div key={estado} className="flex-shrink-0 w-64">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{estadoLabel(estado)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ESTADO_BADGE_CLASS[estado] ?? "bg-muted text-muted-foreground"}`}>{cols.length}</span>
                </div>
                <div className="space-y-2">
                  {cols.length === 0 && (
                    <div className="border border-dashed rounded-lg py-6 text-center text-xs text-muted-foreground">Vacío</div>
                  )}
                  {cols.map(o => (
                    <div key={o.id} className="bg-card border rounded-xl p-3 shadow-sm space-y-1.5 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold">{o.numero}</span>
                        <EstadoPill estado={o.estado} />
                      </div>
                      <p className="text-xs font-medium text-foreground truncate">{pacienteNombre(o.paciente_id)}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.tipo}</p>
                      <p className="text-xs text-muted-foreground">{o.lab_proveedor}</p>
                      {(o as any).armazon_ref && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 truncate">🕶 {(o as any).armazon_ref}</p>
                      )}
                      {((o as any).luna_material || (o as any).luna_tratamientos) && (
                        <p className="text-xs text-cyan-700 dark:text-cyan-400 truncate">
                          👁 {[(o as any).luna_material, (o as any).luna_tratamientos].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {(o as any).precio_venta > 0 && (
                        <p className="text-xs font-semibold text-primary">
                          ${Number((o as any).precio_venta).toFixed(2)}
                          {(o as any).precio_armazon > 0 && (o as any).precio_lunas > 0 && (
                            <span className="text-muted-foreground font-normal ml-1">
                              (Arm ${Number((o as any).precio_armazon).toFixed(2)} + L ${Number((o as any).precio_lunas).toFixed(2)})
                            </span>
                          )}
                        </p>
                      )}
                      <div className="flex gap-1 pt-1 flex-wrap">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(o)}>Editar</Button>
                        {!o.venta_id && o.estado !== "rechazado" && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-emerald-600 font-semibold"
                            onClick={() => {
                              if (!((o as any).precio_venta) || Number((o as any).precio_venta) <= 0) {
                                toast.error("Ingresa el precio de venta antes de facturar")
                                return
                              }
                              navigate("/ventas/nueva", { state: { orden: o, paciente_id: o.paciente_id } })
                            }}>
                            <ShoppingCart className="h-3 w-3 mr-1" />Facturar
                          </Button>
                        )}
                        {o.venta_id && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-emerald-600"
                            onClick={() => navigate(`/ventas/${o.venta_id}`)}>
                            ✓ Ver venta
                          </Button>
                        )}
                        {o.lab_telefono && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-blue-600"
                              title="WhatsApp manual" onClick={() => enviarAlLab(o, pacienteNombre(o.paciente_id))}>
                              <Send className="h-3 w-3" />
                            </Button>
                            {waCloudEnabled && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-600"
                                title="Enviar via Cloud API" disabled={waApiMut.isPending}
                                onClick={() => waApiMut.mutate(o.id)}>
                                <Zap className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">N°</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Paciente</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Lab.</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Envío</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Entrega est.</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="text-right px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Sin órdenes registradas</td></tr>
              )}
              {ordenesFiltradas.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((o, i) => (
                <tr key={o.id} className="border-t hover:bg-muted/30 table-row-anim" style={{ animationDelay: `${i * 25}ms` }}>
                  <td className="px-4 py-2 font-mono font-medium">
                    {o.numero}
                  </td>
                  <td className="px-4 py-2">{pacienteNombre(o.paciente_id)}</td>
                  <td className="px-4 py-2">{o.lab_proveedor}</td>
                  <td className="px-4 py-2">{o.tipo}</td>
                  <td className="px-4 py-2">{fmtDate(o.fecha_envio)}</td>
                  <td className="px-4 py-2">{o.fecha_entrega_est ? fmtDate(o.fecha_entrega_est) : "—"}</td>
                  <td className="px-4 py-2">
                    <button
                      className="flex items-center gap-1 rounded-lg hover:bg-muted/60 px-1.5 py-1 transition-colors"
                      onClick={e => {
                        estadoAnchorRef.current = e.currentTarget
                        setEstadoDropdown(estadoDropdown === o.id ? null : o.id)
                      }}
                    >
                      <EstadoPill estado={o.estado} />
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <EstadoDropdownPortal
                      anchorEl={estadoDropdown === o.id ? estadoAnchorRef.current : null}
                      open={estadoDropdown === o.id}
                      onClose={() => setEstadoDropdown(null)}
                      estados={ESTADOS_ORDEN}
                      current={o.estado}
                      onSelect={s => {
                        const sinProveedor = o.lab_proveedor !== "Stock propio" && (!o.lab_proveedor || o.lab_proveedor === "Pendiente")
                        if (s === "listo" && sinProveedor) {
                          setEstadoDropdown(null)
                          toast.error("Completa el laboratorio proveedor antes de marcar la orden como lista")
                          openEdit(o)
                          return
                        }
                        const IRREVERSIBLES = ["entregado", "rechazado"]
                        if (IRREVERSIBLES.includes(s)) {
                          confirmAction(`¿Cambiar estado a "${s}"? Difícil de revertir.`, () => estadoMut.mutate({ id: o.id, estado: s }), "Cambiar")
                          return
                        }
                        estadoMut.mutate({ id: o.id, estado: s })
                      }}
                    />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm">
                    {(o as any).precio_venta && Number((o as any).precio_venta) > 0 ? (
                      <span className="font-semibold text-primary">{fmtMoney(Number((o as any).precio_venta))}</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                    {(o as any).precio_armazon > 0 || (o as any).precio_lunas > 0 ? (
                      <p className="text-xs text-muted-foreground leading-tight">
                        {(o as any).precio_armazon > 0 && <span>Arm ${Number((o as any).precio_armazon).toFixed(2)}</span>}
                        {(o as any).precio_armazon > 0 && (o as any).precio_lunas > 0 && " + "}
                        {(o as any).precio_lunas > 0 && <span>L ${Number((o as any).precio_lunas).toFixed(2)}</span>}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(o)}>Editar</Button>
                      <Button variant="ghost" size="sm" title="Imprimir orden" onClick={() => printOrden(o, pacienteNombre(o.paciente_id), brandLogo)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Imprimir etiqueta de lente" onClick={() => printEtiqueta(o, pacienteNombre(o.paciente_id))}>
                        <Tag className="h-4 w-4" />
                      </Button>
                      {(o.estado === "listo" || o.estado === "entregado") && (
                        <Button
                          variant="ghost" size="sm" title="Formato de aceptación"
                          onClick={() => printAceptacion(o, pacienteNombre(o.paciente_id), config?.firma_electronica || "", brandLogo)}
                        >
                          <Printer className="h-4 w-4 text-indigo-600" />
                        </Button>
                      )}
                      {o.lab_telefono && (
                        <>
                          <Button
                            variant="ghost" size="sm" className="text-blue-700"
                            title="Abrir WhatsApp (texto manual)"
                            onClick={() => enviarAlLab(o, pacienteNombre(o.paciente_id))}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          {waCloudEnabled && (
                            <Button
                              variant="ghost" size="sm" className="text-emerald-600"
                              title="Enviar directamente via WhatsApp Cloud API"
                              disabled={waApiMut.isPending}
                              onClick={() => waApiMut.mutate(o.id)}
                            >
                              {waApiMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            </Button>
                          )}
                        </>
                      )}
                      {o.estado === "listo" && (
                        <Button
                          variant="ghost" size="sm" className="text-green-600"
                          title="Notificar al paciente"
                          onClick={() => enviarOrdenLista(pacienteTelefono(o.paciente_id), pacienteNombre(o.paciente_id), o.numero)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {!o.venta_id && o.estado !== "rechazado" && (
                        <Button
                          variant="ghost" size="sm" className="text-emerald-600 dark:text-emerald-400 font-medium text-xs"
                          title="Crear venta desde esta orden"
                          onClick={() => navigate("/ventas/nueva", { state: { orden: o, paciente_id: o.paciente_id } })}
                        >
                          $ Facturar
                        </Button>
                      )}
                      {o.venta_id && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
                          onClick={() => navigate(`/ventas/${o.venta_id}`)}
                          title="Ver venta"
                        >
                          ✓ Ver venta
                        </Button>
                      )}
                      {/* Solo el admin borra, y solo órdenes sin venta (el backend también lo valida) */}
                      {rolUsuario === "admin" && !o.venta_id && (
                        <Button
                          variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                          title="Eliminar orden"
                          onClick={() => deleteWithUndo(
                            `Orden ${o.numero} eliminada`,
                            () => deleteMut.mutate(o.id),
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          <Paginador page={page} total={ordenesFiltradas.length} perPage={PER_PAGE} onChange={setPage} onPerPageChange={n => { setPER_PAGE(n); setPage(1) }} />
        </div>
      )
      }

      <OrdenFormDialog ctx={ctx} />
    </div>
  )
}
