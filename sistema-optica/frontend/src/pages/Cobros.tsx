import { Fragment } from "react"
import { Plus, Loader2, ChevronDown, ChevronUp, Trash2, ArrowLeftRight, Building2, Pencil, Search, FileSpreadsheet } from "lucide-react"
import { deleteWithUndo, confirmAction } from "@/lib/confirm"
import { metodoLabel } from "@/lib/metodosCuenta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Paginador } from "@/components/ui/Paginador"
import { fmtMoney as fmt, fmtDate } from "@/lib/format"
import { estadoLabel } from "@/lib/estados"
import { ResumenDiario, CxPAcciones, CxPItemsPanel } from "@/pages/cobros/componentes"
import { useCobros } from "@/pages/cobros/useCobros"
import CobrosDialogos from "@/pages/cobros/CobrosDialogos"
import { type Cobro, type Egreso, type CxP } from "@/pages/cobros/tipos"
import { exportExcel } from "@/lib/excel"

function EstadoBadge({ estado }: { estado: string }) {
  const v = { pendiente: "secondary", parcial: "outline", pagado: "default" } as const
  return <Badge variant={v[estado as keyof typeof v] ?? "outline"}>{estadoLabel(estado)}</Badge>
}

export default function Cobros() {
  const ctx = useCobros()
  const {
    tab,
    setTab,
    mesOffset,
    setMesOffset,
    desde,
    setDesde,
    hasta,
    setHasta,
    irAMes,
    verTodo,
    nombreMes,
    busqConcepto,
    setBusqConcepto,
    pageCobros,
    setPageCobros,
    pageEgresos,
    setPageEgresos,
    pageCxP,
    setPageCxP,
    perPage,
    setPerPage,
    expandedCxP,
    setExpandedCxP,
    setDialogNuevoProd,
    setNuevoProdNombre,
    setNuevoProdCodigo,
    setNuevoProdPrecioCosto,
    setNuevoProdPrecioVenta,
    setDialogTransferencia,
    rol,
    veTesoreria,
    cuentas,
    cobros,
    cargCobros,
    egresos,
    cargEgr,
    cxps,
    cargCxP,
    cxpItems,
    productosMin,
    transferencias,
    resetTrf,
    eliminarCxPMut,
    eliminarCxPItemMut,
    abrirNuevoItem,
    abrirPagoTodo,
    eliminarCobroMut,
    eliminarEgresoMut,
    eliminarCuentaMut,
    abrirNuevaCuenta,
    abrirEditarCuenta,
    hoy,
    totalCobros,
    totalEgresos,
    totalActivos,
    cxpPendiente,
    TABS,
    abrirCobro,
    abrirEgreso,
    abrirCxP,
    abrirPago,
  } = ctx


  // Exporta a Excel lo que se ve en la pestaña actual (período y búsqueda incluidos)
  function exportarExcel() {
    const periodo = desde && hasta ? `${desde}_a_${hasta}` : "todo"
    const filtraConcepto = <T extends { concepto?: string | null }>(l: T[]) =>
      l.filter(x => !busqConcepto || x.concepto?.toLowerCase().includes(busqConcepto.toLowerCase()))
    if (tab === "cobros") {
      exportExcel<Cobro>(`cobros_${periodo}`, "Cobros", [
        { titulo: "Número", valor: c => c.numero },
        { titulo: "Fecha", valor: c => c.fecha, tipo: "fecha" },
        { titulo: "Concepto", valor: c => c.concepto },
        { titulo: "Método", valor: c => metodoLabel(c.metodo_pago) },
        { titulo: "Monto", valor: c => c.monto, tipo: "moneda" },
      ], filtraConcepto(cobros))
    } else if (tab === "egresos") {
      exportExcel<Egreso>(`egresos_${periodo}`, "Egresos", [
        { titulo: "Número", valor: e => e.numero },
        { titulo: "Fecha", valor: e => e.fecha, tipo: "fecha" },
        { titulo: "Categoría", valor: e => e.categoria },
        { titulo: "Concepto", valor: e => e.concepto },
        { titulo: "Método", valor: e => metodoLabel(e.metodo_pago) },
        { titulo: "Monto", valor: e => e.monto, tipo: "moneda" },
      ], filtraConcepto(egresos))
    } else if (tab === "cxp") {
      exportExcel<CxP>("cuentas_por_pagar", "Por pagar", [
        { titulo: "Proveedor", valor: c => c.proveedor },
        { titulo: "Concepto", valor: c => c.concepto },
        { titulo: "Emisión", valor: c => c.fecha_emision, tipo: "fecha" },
        { titulo: "Vence", valor: c => c.fecha_vencimiento, tipo: "fecha" },
        { titulo: "Total", valor: c => c.monto_total, tipo: "moneda" },
        { titulo: "Pagado", valor: c => c.monto_pagado, tipo: "moneda" },
        { titulo: "Saldo", valor: c => Number(c.monto_total) - Number(c.monto_pagado), tipo: "moneda" },
        { titulo: "Estado", valor: c => estadoLabel(c.estado) },
      ], cxps)
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{veTesoreria ? "Cobros y egresos" : "Cobros"}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {veTesoreria
            ? "Lo que entra (cobros), lo que sale (egresos y pagos a proveedores) y el saldo de cada cuenta"
            : "Pagos recibidos de los pacientes"}
        </p>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {veTesoreria && <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total en cuentas</p><p className="text-xl font-bold text-green-600">{fmt(totalActivos)}</p></CardContent></Card>}
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Cobros período</p><p className="text-xl font-bold">{fmt(totalCobros)}</p></CardContent></Card>
        {veTesoreria && <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Egresos período</p><p className="text-xl font-bold text-amber-600">{fmt(totalEgresos)}</p></CardContent></Card>}
        {veTesoreria && <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Por pagar a proveedores</p><p className="text-xl font-bold text-red-600">{fmt(cxpPendiente)}</p></CardContent></Card>}
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Filtro fechas */}
      {(tab === "cobros" || tab === "egresos") && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border rounded-lg px-1">
            <button onClick={() => irAMes((isNaN(mesOffset) ? 0 : mesOffset) - 1)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>
            <span className="inline-block text-sm font-medium first-letter:uppercase px-1 min-w-[130px] text-center">
              {isNaN(mesOffset) ? "Todos los meses" : nombreMes(mesOffset)}
            </span>
            <button onClick={() => irAMes((isNaN(mesOffset) ? 0 : mesOffset) + 1)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
          </div>
          {mesOffset !== 0 && !isNaN(mesOffset) && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => irAMes(0)}>Mes actual</Button>
          )}
          {!isNaN(mesOffset) && (
            <Button variant="ghost" size="sm" className="h-9" onClick={verTodo}>Ver todo</Button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-9 w-48" placeholder="Buscar concepto..." value={busqConcepto} onChange={e => setBusqConcepto(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Desde</span>
            <Input type="date" value={desde} onChange={e => { setDesde(e.target.value); setMesOffset(NaN) }} className="h-9 w-40" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Hasta</span>
            <Input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setMesOffset(NaN) }} className="h-9 w-40" />
          </div>
          {busqConcepto && <Button variant="ghost" size="sm" onClick={() => setBusqConcepto("")}>Limpiar búsqueda</Button>}
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={exportarExcel} title="Descargar lo que se ve en la tabla">
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
            {tab === "cobros" && (rol === "admin" || rol === "cajero" || rol === "vendedor") && (
              <Button size="sm" onClick={abrirCobro}><Plus className="h-4 w-4 mr-1" /> Nuevo Cobro</Button>
            )}
            {tab === "egresos" && (rol === "admin" || rol === "cajero") && (
              <Button size="sm" onClick={abrirEgreso}><Plus className="h-4 w-4 mr-1" /> Nuevo Egreso</Button>
            )}
          </div>
        </div>
      )}

      {/* Tab: Cobros */}
      {tab === "cobros" && (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Número</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Concepto</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Método</th>
                <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Monto</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {cargCobros && <tr><td colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
              {!cargCobros && cobros.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No hay cobros en el período</td></tr>}
              {cobros.filter(c => !busqConcepto || c.concepto?.toLowerCase().includes(busqConcepto.toLowerCase())).slice((pageCobros - 1) * perPage, pageCobros * perPage).map(c => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3"><Badge variant="outline">{c.numero}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(c.fecha)}</td>
                  <td className="px-4 py-3">{c.concepto}{c.venta_id && <span className="ml-2 text-xs text-muted-foreground">VEN #{c.venta_id}</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">{metodoLabel(c.metodo_pago)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">{fmt(c.monto)}</td>
                  <td className="px-4 py-3">
                    {rol === "admin" && (
                      <button title="Eliminar cobro" onClick={() => deleteWithUndo(`Cobro ${c.numero} eliminado`, () => eliminarCobroMut.mutate(c.id))} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          <Paginador page={pageCobros} total={cobros.length} perPage={perPage} onChange={setPageCobros} onPerPageChange={n => { setPerPage(n); setPageCobros(1) }} />
        </div>
      )}

      {/* Tab: Egresos */}
      {tab === "egresos" && (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Número</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Categoría</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Concepto</th>
                <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Monto</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {cargEgr && <tr><td colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
              {!cargEgr && egresos.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No hay egresos en el período</td></tr>}
              {egresos.slice((pageEgresos - 1) * perPage, pageEgresos * perPage).map(e => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3"><Badge variant="outline">{e.numero}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(e.fecha)}</td>
                  <td className="px-4 py-3"><Badge variant="secondary">{e.categoria}</Badge></td>
                  <td className="px-4 py-3">{e.concepto}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmt(e.monto)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteWithUndo(`Egreso ${e.numero} eliminado`, () => eliminarEgresoMut.mutate(e.id))} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          <Paginador page={pageEgresos} total={egresos.length} perPage={perPage} onChange={setPageEgresos} onPerPageChange={n => { setPerPage(n); setPageEgresos(1) }} />
        </div>
      )}

      {/* Tab: CxP */}
      {tab === "cxp" && (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={exportarExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
            {(rol === "admin" || rol === "cajero") && (
              <Button size="sm" onClick={abrirCxP}><Plus className="h-4 w-4 mr-1" /> Nueva CxP</Button>
            )}
          </div>

          {!cargCxP && cxps.length > 0 && (() => {
            const pendientes = cxps.filter(c => c.estado !== "pagado")
            const porProveedor = Object.values(
              pendientes.reduce((acc: Record<string, { proveedor: string; total: number; facturas: number }>, c) => {
                const key = c.proveedor
                if (!acc[key]) acc[key] = { proveedor: key, total: 0, facturas: 0 }
                acc[key].total += c.monto_total - c.monto_pagado
                acc[key].facturas++
                return acc
              }, {})
            ).sort((a, b) => b.total - a.total)

            return porProveedor.length > 0 ? (
              <div className="bg-card rounded-2xl border shadow-sm p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Total pendiente por proveedor</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {porProveedor.map(p => (
                    <div key={p.proveedor} className="border rounded-xl p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.proveedor}</p>
                        <p className="text-xs text-muted-foreground">{p.facturas} factura{p.facturas !== 1 ? "s" : ""}</p>
                        <p className="text-lg font-bold text-red-600">{fmt(p.total)}</p>
                      </div>
                      {(rol === "admin" || rol === "cajero") && (
                        <Button size="sm" variant="outline" className="shrink-0" onClick={() => abrirPagoTodo(p.proveedor, p.total)}>
                          Pagar todo
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          })()}

          {cargCxP && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          {!cargCxP && cxps.length === 0 && <p className="text-center py-10 text-muted-foreground">No hay cuentas por pagar</p>}

          {/* Desktop table */}
          {!cargCxP && cxps.length > 0 && (
            <div className="hidden md:block bg-card rounded-2xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-8 px-2 py-3" />
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Proveedor</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Concepto</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Emisión</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Vencimiento</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Pendiente</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {cxps.slice((pageCxP - 1) * perPage, pageCxP * perPage).map(c => (
                    <Fragment key={c.id}>
                      <tr className={`hover:bg-muted/30 ${c.estado === "pagado" ? "opacity-60" : ""}`}>
                        <td className="px-2 py-3">
                          <button onClick={() => setExpandedCxP(expandedCxP === c.id ? null : c.id)}
                            className="text-muted-foreground hover:text-foreground p-0.5">
                            {expandedCxP === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium max-w-[200px] truncate">{c.proveedor}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.concepto}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.fecha_emision}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.fecha_vencimiento ?? "—"}</td>
                        <td className="px-4 py-3 text-right">{fmt(c.monto_total)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(c.monto_total - c.monto_pagado)}</td>
                        <td className="px-4 py-3"><EstadoBadge estado={c.estado} /></td>
                        <td className="px-4 py-3">
                          <CxPAcciones c={c} rol={rol} onPagar={() => abrirPago(c)} onEliminar={() => eliminarCxPMut.mutate(c.id)} />
                        </td>
                      </tr>
                      {expandedCxP === c.id && (
                        <tr key={`items-${c.id}`} className="bg-muted/20">
                          <td colSpan={9} className="px-6 py-3">
                            <CxPItemsPanel items={cxpItems} productos={productosMin}
                              onCrearProd={(it) => { setNuevoProdNombre(it.descripcion); setNuevoProdCodigo(it.codigo_proveedor ?? ""); setNuevoProdPrecioCosto(it.precio_unitario ? String(it.precio_unitario) : ""); setNuevoProdPrecioVenta(""); setDialogNuevoProd(it) }}
                              onEliminar={(itemId) => eliminarCxPItemMut.mutate(itemId)}
                              onAgregar={() => expandedCxP && abrirNuevoItem(expandedCxP)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
        </div>
              <Paginador page={pageCxP} total={cxps.length} perPage={perPage} onChange={setPageCxP} onPerPageChange={n => { setPerPage(n); setPageCxP(1) }} />
            </div>
          )}

          {/* Mobile cards */}
          {!cargCxP && cxps.length > 0 && (
            <div className="md:hidden space-y-3">
              {cxps.slice((pageCxP - 1) * perPage, pageCxP * perPage).map(c => (
                <div key={c.id} className={`border rounded-lg bg-card overflow-hidden ${c.estado === "pagado" ? "opacity-70" : ""}`}>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{c.proveedor}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.concepto}</p>
                      </div>
                      <EstadoBadge estado={c.estado} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-medium">{fmt(c.monto_total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pendiente</p>
                        <p className="font-semibold text-red-600">{fmt(c.monto_total - c.monto_pagado)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Emisión</p>
                        <p className="text-xs">{c.fecha_emision}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => setExpandedCxP(expandedCxP === c.id ? null : c.id)}
                        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
                        {expandedCxP === c.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Ver ítems
                      </button>
                      <div className="ml-auto">
                        <CxPAcciones c={c} rol={rol} onPagar={() => abrirPago(c)} onEliminar={() => eliminarCxPMut.mutate(c.id)} />
                      </div>
                    </div>
                  </div>
                  {expandedCxP === c.id && (
                    <div className="border-t bg-muted/20 px-4 py-3">
                      <CxPItemsPanel items={cxpItems} productos={productosMin}
                        onCrearProd={(it) => { setNuevoProdNombre(it.descripcion); setNuevoProdCodigo(it.codigo_proveedor ?? ""); setNuevoProdPrecioCosto(it.precio_unitario ? String(it.precio_unitario) : ""); setNuevoProdPrecioVenta(""); setDialogNuevoProd(it) }}
                        onEliminar={(itemId) => eliminarCxPItemMut.mutate(itemId)}
                        onAgregar={() => expandedCxP && abrirNuevoItem(expandedCxP)} />
                    </div>
                  )}
                </div>
              ))}
              <Paginador page={pageCxP} total={cxps.length} perPage={perPage} onChange={setPageCxP} onPerPageChange={n => { setPerPage(n); setPageCxP(1) }} />
            </div>
          )}
        </div>
      )}

      {/* Tab: Saldos */}
      {tab === "cuentas" && (
        <>
          <div className="flex justify-end gap-2 mb-1">
            {rol === "admin" && (
              <Button variant="outline" size="sm" onClick={abrirNuevaCuenta}>
                <Building2 className="h-4 w-4 mr-2" /> Nueva cuenta
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { resetTrf({ fecha: hoy, monto: "", concepto: "", notas: "" }); setDialogTransferencia(true) }}>
              <ArrowLeftRight className="h-4 w-4 mr-2" /> Cruce de cuentas
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cuentas.map(c => (
              <Card key={c.id} className={!c.activa ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="font-semibold">{c.nombre}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="font-normal text-xs">{c.tipo}</Badge>
                      {rol === "admin" && (
                        <>
                          <button onClick={() => abrirEditarCuenta(c)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => confirmAction(
                              `¿Eliminar la cuenta "${c.nombre}"?`,
                              () => eliminarCuentaMut.mutate(c.id),
                              "Eliminar",
                            )}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${c.saldo_actual < 0 ? "text-destructive" : "text-green-700"}`}>
                    {fmt(c.saldo_actual)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Historial de transferencias */}
          {transferencias.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" /> Cruces de cuentas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {transferencias.slice(0, 20).map(t => {
                    const origen = cuentas.find(c => c.id === t.cuenta_origen_id)
                    const destino = cuentas.find(c => c.id === t.cuenta_destino_id)
                    return (
                      <div key={t.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-muted-foreground shrink-0">{t.fecha}</span>
                          <span className="text-sm truncate">
                            <span className="font-medium">{origen?.nombre ?? `#${t.cuenta_origen_id}`}</span>
                            <ArrowLeftRight className="h-3 w-3 inline mx-1.5 text-muted-foreground" />
                            <span className="font-medium">{destino?.nombre ?? `#${t.cuenta_destino_id}`}</span>
                          </span>
                          {t.concepto && <span className="text-xs text-muted-foreground truncate hidden md:block">— {t.concepto}</span>}
                        </div>
                        <span className="font-bold text-sm shrink-0 ml-3">{fmt(t.monto)}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <ResumenDiario cobros={cobros} egresos={egresos} />
        </>
      )}

      <CobrosDialogos ctx={ctx} />
    </div>
  )
}

