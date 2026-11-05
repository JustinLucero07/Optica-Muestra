// Ventanas de Cobros y egresos: nuevo cobro, egreso, cuentas por pagar, pagos a proveedores, transferencias y cuentas bancarias.
import { toast } from "sonner"
import { Loader2, X } from "lucide-react"
import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { cuentasParaMetodo, cuentaPorDefecto, METODOS_PAGO, metodoLabel } from "@/lib/metodosCuenta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { fmtMoney as fmt, fmtDate } from "@/lib/format"
import { CATEGORIAS_EGRESO } from "@/pages/cobros/tipos"
import { type CobrosCtx } from "@/pages/cobros/useCobros"

export default function CobrosDialogos({ ctx }: { ctx: CobrosCtx }) {
  const {
    dialogCobro,
    dialogEgreso,
    setDialogEgreso,
    dialogCxP,
    setDialogCxP,
    pagandoCxP,
    setPagandoCxP,
    expandedCxP,
    dialogNuevoProd,
    setDialogNuevoProd,
    nuevoProdNombre,
    setNuevoProdNombre,
    nuevoProdCodigo,
    setNuevoProdCodigo,
    nuevoProdPrecioCosto,
    setNuevoProdPrecioCosto,
    nuevoProdPrecioVenta,
    setNuevoProdPrecioVenta,
    dialogTransferencia,
    setDialogTransferencia,
    dialogNuevaCuenta,
    setDialogNuevaCuenta,
    editandoCuenta,
    setEditandoCuenta,
    ventaSel,
    busqVenta,
    setBusqVenta,
    showVentaList,
    setShowVentaList,
    qc,
    cuentas,
    ventasPendientes,
    cobrosVenta,
    abonadoVenta,
    saldoVenta,
    rC,
    hsC,
    rE,
    hsE,
    watchE,
    rCxP,
    hsCxP,
    rPago,
    hsPago,
    watchPago,
    rTrf,
    hsTrf,
    watchTrf,
    rNC,
    hsNC,
    cobroMut,
    egresoMut,
    cxpMut,
    pagoMut,
    dialogNuevoItem,
    setDialogNuevoItem,
    nuevoItemCodigo,
    setNuevoItemCodigo,
    nuevoItemDescripcion,
    setNuevoItemDescripcion,
    nuevoItemCantidad,
    setNuevoItemCantidad,
    nuevoItemPrecio,
    setNuevoItemPrecio,
    crearCxPItemMut,
    pagandoProveedor,
    setPagandoProveedor,
    pagoTodoMonto,
    setPagoTodoMonto,
    pagoTodoCuentaId,
    setPagoTodoCuentaId,
    pagoTodoMetodo,
    setPagoTodoMetodo,
    pagoTodoFecha,
    setPagoTodoFecha,
    pagarTodoMut,
    transferenciaMut,
    nuevaCuentaMut,
    cerrarCobro,
    seleccionarVenta,
    metodoC,
    limpiarVenta,
    ventasFiltradas,
    SelectCuenta,
    SaldoAviso,
    SelectMetodo,
  } = ctx

  return (
    <>
        {/* Dialog Cobro */}
        <Dialog open={dialogCobro} onClose={cerrarCobro} className="max-w-lg">
          <DialogHeader onClose={cerrarCobro}>Nuevo Cobro</DialogHeader>
          <form onSubmit={hsC(d => cobroMut.mutate(d))}>
            <DialogBody className="space-y-3">
              {/* Venta selector */}
              <div className="space-y-1">
                <Label>Venta a cobrar (opcional)</Label>
                {ventaSel ? (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{ventaSel.numero} · {ventaSel.paciente_nombre ?? "Sin paciente"}</p>
                        <p className="text-xs text-muted-foreground">{ventaSel.fecha}</p>
                      </div>
                      <button type="button" onClick={limpiarVenta} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div className="bg-background rounded p-1.5">
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-semibold">{fmt(ventaSel.total)}</p>
                      </div>
                      <div className="bg-background rounded p-1.5">
                        <p className="text-muted-foreground">Abonado</p>
                        <p className="font-semibold text-green-700">{fmt(abonadoVenta)}</p>
                      </div>
                      <div className="bg-background rounded p-1.5">
                        <p className="text-muted-foreground">Saldo</p>
                        <p className="font-semibold text-amber-700">{fmt(saldoVenta)}</p>
                      </div>
                    </div>
                    {cobrosVenta.length > 0 && (
                      <div className="space-y-1 border-t pt-2">
                        <p className="text-xs font-medium text-muted-foreground">Pagos anteriores</p>
                        {cobrosVenta.map(c => (
                          <div key={c.id} className="flex justify-between text-xs text-muted-foreground">
                            <span>{fmtDate(c.fecha)} · {metodoLabel(c.metodo_pago)}</span>
                            <span className="font-medium text-foreground">{fmt(c.monto)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Buscar por número de venta o paciente..."
                      value={busqVenta}
                      onChange={e => { setBusqVenta(e.target.value); setShowVentaList(true) }}
                      onFocus={() => setShowVentaList(true)}
                      onBlur={() => setTimeout(() => setShowVentaList(false), 150)}
                    />
                    {showVentaList && (busqVenta || ventasPendientes.length > 0) && (
                      <div className="absolute z-20 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                        {ventasPendientes.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-3">No hay ventas pendientes</p>
                        )}
                        {ventasFiltradas.slice(0, 20).map(v => (
                          <button
                            key={v.id} type="button"
                            onMouseDown={() => seleccionarVenta(v)}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center"
                          >
                            <span>
                              <span className="font-mono font-medium">{v.numero}</span>
                              {v.paciente_nombre && <span className="text-muted-foreground ml-2">· {v.paciente_nombre}</span>}
                            </span>
                            <span className="text-green-700 font-medium ml-2">{fmt(v.total)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Fecha *</Label>
                  <Input type="date" {...rC("fecha", { required: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Monto ($) *</Label>
                  <Input type="number" step="0.01" min="0.01" {...rC("monto", { required: true, min: 0.01 })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Concepto *</Label>
                <Input placeholder="Cobro venta, abono cuota…" {...rC("concepto", { required: true })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Método de pago *</Label>
                  <SelectMetodo reg={rC("metodo_pago")} />
                </div>
                <div className="space-y-1">
                  <Label>Cuenta destino *</Label>
                  <SelectCuenta reg={rC("cuenta_bancaria_id", { required: true })} metodo={metodoC} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Referencia</Label>
                <Input placeholder="Nro. cheque, transferencia…" {...rC("referencia")} />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={cerrarCobro}>Cancelar</Button>
              <Button type="submit" disabled={cobroMut.isPending}>
                {cobroMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Registrar
              </Button>
            </DialogFooter>
          </form>
        </Dialog>

        {/* Dialog Egreso */}
        <Dialog open={dialogEgreso} onClose={() => setDialogEgreso(false)} className="max-w-lg">
          <DialogHeader onClose={() => setDialogEgreso(false)}>Nuevo Egreso</DialogHeader>
          <form onSubmit={hsE(d => egresoMut.mutate(d))}>
            <DialogBody className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Fecha *</Label>
                  <Input type="date" {...rE("fecha", { required: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Monto ($) *</Label>
                  <Input type="number" step="0.01" min="0.01" {...rE("monto", { required: true })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Categoría *</Label>
                <select {...rE("categoria", { required: true })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">— seleccionar —</option>
                  {CATEGORIAS_EGRESO.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Concepto *</Label>
                <Input placeholder="Descripción del gasto" {...rE("concepto", { required: true })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Método de pago *</Label>
                  <SelectMetodo reg={rE("metodo_pago")} />
                </div>
                <div className="space-y-1">
                  <Label>Cuenta origen *</Label>
                  <SelectCuenta reg={rE("cuenta_bancaria_id", { required: true })} metodo={watchE("metodo_pago")} esIngreso={false} />
                </div>
              </div>
              <SaldoAviso cuentaId={watchE("cuenta_bancaria_id")} monto={watchE("monto")} />
              <div className="space-y-1">
                <Label>Referencia</Label>
                <Input placeholder="Comprobante, factura…" {...rE("referencia")} />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogEgreso(false)}>Cancelar</Button>
              <Button type="submit" disabled={egresoMut.isPending || (() => {
                const cuenta = cuentas.find(c => c.id === Number(watchE("cuenta_bancaria_id")))
                const m = parseFloat(watchE("monto") || "0")
                return !!cuenta && m > 0 && cuenta.saldo_actual < m
              })()}>
                {egresoMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Registrar
              </Button>
            </DialogFooter>
          </form>
        </Dialog>

        {/* Dialog CxP */}
        <Dialog open={dialogCxP} onClose={() => setDialogCxP(false)} className="max-w-lg">
          <DialogHeader onClose={() => setDialogCxP(false)}>Nueva Cuenta por Pagar</DialogHeader>
          <form onSubmit={hsCxP(d => cxpMut.mutate(d))}>
            <DialogBody className="space-y-3">
              <div className="space-y-1">
                <Label>Proveedor / Lab *</Label>
                <Input placeholder="Nombre del proveedor" {...rCxP("proveedor", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Concepto *</Label>
                <Input placeholder="Descripción" {...rCxP("concepto", { required: true })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Monto Total ($) *</Label>
                  <Input type="number" step="0.01" min="0.01" {...rCxP("monto_total", { required: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Referencia</Label>
                  <Input placeholder="Nro. orden, factura…" {...rCxP("referencia")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Fecha emisión *</Label>
                  <Input type="date" {...rCxP("fecha_emision", { required: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Fecha vencimiento</Label>
                  <Input type="date" {...rCxP("fecha_vencimiento")} />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogCxP(false)}>Cancelar</Button>
              <Button type="submit" disabled={cxpMut.isPending}>
                {cxpMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Crear
              </Button>
            </DialogFooter>
          </form>
        </Dialog>

        {/* Dialog Pago CxP */}
        <Dialog open={!!pagandoCxP} onClose={() => setPagandoCxP(null)} className="max-w-md">
          <DialogHeader onClose={() => setPagandoCxP(null)}>
            Registrar Pago — {pagandoCxP?.proveedor}
          </DialogHeader>
          <form onSubmit={hsPago(d => pagoMut.mutate(d))}>
            <DialogBody className="space-y-3">
              {pagandoCxP && (
                <p className="text-sm text-muted-foreground">
                  Pendiente: <strong className="text-foreground">{fmt(pagandoCxP.monto_total - pagandoCxP.monto_pagado)}</strong>
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Monto a pagar ($) *</Label>
                  <Input type="number" step="0.01" min="0.01" {...rPago("monto", { required: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Fecha *</Label>
                  <Input type="date" {...rPago("fecha", { required: true })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Método *</Label>
                  <SelectMetodo reg={rPago("metodo_pago")} />
                </div>
                <div className="space-y-1">
                  <Label>Cuenta origen *</Label>
                  <SelectCuenta reg={rPago("cuenta_bancaria_id", { required: true })} metodo={watchPago("metodo_pago")} esIngreso={false} />
                </div>
              </div>
              <SaldoAviso cuentaId={watchPago("cuenta_bancaria_id")} monto={watchPago("monto")} />
              <div className="space-y-1">
                <Label>Referencia</Label>
                <Input placeholder="Nro. transferencia, cheque…" {...rPago("referencia")} />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPagandoCxP(null)}>Cancelar</Button>
              <Button type="submit" disabled={pagoMut.isPending}>
                {pagoMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar pago
              </Button>
            </DialogFooter>
          </form>
        </Dialog>

        {/* Dialog pagar todo a un proveedor */}
        <Dialog open={!!pagandoProveedor} onClose={() => setPagandoProveedor(null)} className="max-w-md">
          <DialogHeader onClose={() => setPagandoProveedor(null)}>
            Pagar todo — {pagandoProveedor}
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Se pagarán las facturas pendientes de este proveedor, de la más antigua a la más reciente, hasta cubrir el monto ingresado.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto a pagar ($) *</Label>
                <Input type="number" step="0.01" min="0.01" value={pagoTodoMonto} onChange={e => setPagoTodoMonto(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fecha *</Label>
                <Input type="date" value={pagoTodoFecha} onChange={e => setPagoTodoFecha(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Método *</Label>
                <select value={pagoTodoMetodo} onChange={e => {
                  const m = e.target.value
                  setPagoTodoMetodo(m)
                  if (!cuentasParaMetodo(cuentas, m, false).some(c => String(c.id) === pagoTodoCuentaId))
                    setPagoTodoCuentaId(String(cuentaPorDefecto(cuentas, m, false)?.id ?? ""))
                }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{metodoLabel(m)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Cuenta origen *</Label>
                <select value={pagoTodoCuentaId} onChange={e => setPagoTodoCuentaId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {cuentasParaMetodo(cuentas, pagoTodoMetodo, false).map(c => <option key={c.id} value={c.id}>{c.nombre} ({fmt(c.saldo_actual)})</option>)}
                </select>
              </div>
            </div>
            <SaldoAviso cuentaId={pagoTodoCuentaId} monto={pagoTodoMonto} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPagandoProveedor(null)}>Cancelar</Button>
            <Button
              onClick={() => pagarTodoMut.mutate()}
              disabled={pagarTodoMut.isPending || !pagoTodoCuentaId || !pagoTodoMonto}
            >
              {pagarTodoMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar pagos
            </Button>
          </DialogFooter>
        </Dialog>

        {/* Dialog agregar ítem manual a una factura */}
        <Dialog open={dialogNuevoItem !== null} onClose={() => setDialogNuevoItem(null)} className="max-w-md">
          <DialogHeader onClose={() => setDialogNuevoItem(null)}>Agregar ítem a la factura</DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Útil cuando el proveedor generaliza varios productos en una sola línea (ej: "3 armazones $50") y necesitas desglosarlos para vincular cada uno a su código de inventario.
            </p>
            <div className="space-y-1">
              <Label>Descripción *</Label>
              <Input value={nuevoItemDescripcion} onChange={e => setNuevoItemDescripcion(e.target.value)} placeholder="Ej: Armazón modelo X" />
            </div>
            <div className="space-y-1">
              <Label>Código del proveedor</Label>
              <Input value={nuevoItemCodigo} onChange={e => setNuevoItemCodigo(e.target.value)} placeholder="Si la factura ya trae un código, ponlo aquí" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cantidad *</Label>
                <Input type="number" step="1" min="1" value={nuevoItemCantidad} onChange={e => setNuevoItemCantidad(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Precio unitario ($) *</Label>
                <Input type="number" step="0.01" min="0.01" value={nuevoItemPrecio} onChange={e => setNuevoItemPrecio(e.target.value)} />
              </div>
            </div>
            {Number(nuevoItemCantidad) > 0 && Number(nuevoItemPrecio) > 0 && (
              <p className="text-sm text-muted-foreground">Subtotal: <strong className="text-foreground">{fmt(Number(nuevoItemCantidad) * Number(nuevoItemPrecio))}</strong></p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogNuevoItem(null)}>Cancelar</Button>
            <Button
              type="button"
              disabled={crearCxPItemMut.isPending || !nuevoItemDescripcion.trim() || !(Number(nuevoItemCantidad) > 0) || !(Number(nuevoItemPrecio) > 0)}
              onClick={() => crearCxPItemMut.mutate()}
            >
              {crearCxPItemMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Agregar ítem
            </Button>
          </DialogFooter>
        </Dialog>

        {/* Dialog crear producto desde ítem CxP */}
        <Dialog open={!!dialogNuevoProd} onClose={() => setDialogNuevoProd(null)} className="max-w-md">
          <DialogHeader onClose={() => setDialogNuevoProd(null)}>Crear producto en inventario</DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Se creará el producto y se vinculará al ítem de esta factura. La próxima vez que llegue el mismo código del proveedor se detectará automáticamente.
            </p>
            <div className="space-y-1">
              <Label>Nombre del producto *</Label>
              <Input value={nuevoProdNombre} onChange={e => setNuevoProdNombre(e.target.value)} placeholder="Nombre en tu inventario..." />
            </div>
            <div className="space-y-1">
              <Label>Código interno</Label>
              <Input value={nuevoProdCodigo} onChange={e => setNuevoProdCodigo(e.target.value)} placeholder="Ej: ARM-001" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Precio costo ($)</Label>
                <Input type="number" step="0.01" min="0" value={nuevoProdPrecioCosto} onChange={e => setNuevoProdPrecioCosto(e.target.value)} placeholder="0.00" />
                <p className="text-xs text-muted-foreground">Tomado de la factura</p>
              </div>
              <div className="space-y-1">
                <Label>Precio venta ($)</Label>
                <Input type="number" step="0.01" min="0" value={nuevoProdPrecioVenta} onChange={e => setNuevoProdPrecioVenta(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogNuevoProd(null)}>Cancelar</Button>
            <Button
              type="button"
              disabled={!nuevoProdNombre.trim()}
              onClick={async () => {
                if (!dialogNuevoProd || !nuevoProdNombre.trim()) return
                try {
                  const res = await api.post("/productos", {
                    nombre: nuevoProdNombre.trim(),
                    codigo: nuevoProdCodigo.trim() || null,
                    precio_costo: Number(nuevoProdPrecioCosto) || 0,
                    precio_venta: Number(nuevoProdPrecioVenta) || 0,
                    stock_actual: 0, stock_minimo: 0, unidad: "unidad",
                  })
                  const prod = res.data
                  // vincular ítem al producto
                  await api.post(`/cxp/${expandedCxP}/items/${dialogNuevoProd.id}/vincular`, null, { params: { producto_id: prod.id } })
                  // guardar mapeo SRI
                  if (dialogNuevoProd.codigo_proveedor) {
                    await api.post("/sri/mapear-items", { mapeos: [{ codigo_proveedor: dialogNuevoProd.codigo_proveedor, descripcion_proveedor: dialogNuevoProd.descripcion, producto_id: prod.id, proveedor_id: null }] })
                  }
                  toast.success(`Producto "${prod.nombre}" creado y vinculado`)
                  qc.invalidateQueries({ queryKey: ["cxp-items", expandedCxP] })
                  qc.invalidateQueries({ queryKey: ["productos-mini"] })
                  setDialogNuevoProd(null)
                } catch (e) {
                  toast.error(errMsg(e, "Error al crear producto"))
                }
              }}
            >
              Crear y vincular
            </Button>
          </DialogFooter>
        </Dialog>

        {/* Dialog Cruce de cuentas */}
        <Dialog open={dialogTransferencia} onClose={() => setDialogTransferencia(false)} className="max-w-md">
          <DialogHeader onClose={() => setDialogTransferencia(false)}>Cruce de cuentas</DialogHeader>
          <form onSubmit={hsTrf(d => transferenciaMut.mutate(d))}>
            <DialogBody className="space-y-4">
              <div className="space-y-1">
                <Label>Fecha *</Label>
                <Input type="date" {...rTrf("fecha", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Cuenta origen (de donde sale) *</Label>
                <select {...rTrf("cuenta_origen_id", { required: true })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">— seleccionar —</option>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({fmt(c.saldo_actual)})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Cuenta destino (a donde entra) *</Label>
                <select {...rTrf("cuenta_destino_id", { required: true })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">— seleccionar —</option>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({fmt(c.saldo_actual)})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Monto ($) *</Label>
                  <Input type="number" step="0.01" min="0.01" {...rTrf("monto", { required: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Comisión bancaria ($)</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" {...rTrf("comision")} />
                </div>
              </div>
              <SaldoAviso cuentaId={watchTrf("cuenta_origen_id")} monto={watchTrf("monto")} />
              <div className="space-y-1">
                <Label>Concepto</Label>
                <Input placeholder="Ej: Traslado para cubrir gastos…" {...rTrf("concepto")} />
              </div>
              <div className="space-y-1">
                <Label>Notas</Label>
                <Input {...rTrf("notas")} />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogTransferencia(false)}>Cancelar</Button>
              <Button type="submit" disabled={transferenciaMut.isPending}>
                {transferenciaMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar cruce
              </Button>
            </DialogFooter>
          </form>
        </Dialog>

        {/* Dialog Nueva / Editar cuenta bancaria */}
        <Dialog open={dialogNuevaCuenta} onClose={() => { setDialogNuevaCuenta(false); setEditandoCuenta(null) }} className="max-w-sm">
          <DialogHeader onClose={() => { setDialogNuevaCuenta(false); setEditandoCuenta(null) }}>
            {editandoCuenta ? `Editar — ${editandoCuenta.nombre}` : "Nueva cuenta bancaria"}
          </DialogHeader>
          <form onSubmit={hsNC(d => nuevaCuentaMut.mutate(d))}>
            <DialogBody className="space-y-4">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input placeholder="Ej: Banco Pichincha, Efectivo caja…" {...rNC("nombre", { required: "Requerido" })} />
              </div>
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <select {...rNC("tipo")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="banco">Banco</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="electronico">Billetera electrónica</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              {!editandoCuenta && (
                <div className="space-y-1">
                  <Label>Saldo inicial ($)</Label>
                  <Input type="number" step="0.01" min="0" {...rNC("saldo_inicial")} />
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogNuevaCuenta(false); setEditandoCuenta(null) }}>Cancelar</Button>
              <Button type="submit" disabled={nuevaCuentaMut.isPending}>
                {nuevaCuentaMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editandoCuenta ? "Guardar" : "Crear cuenta"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
    </>
  )
}
