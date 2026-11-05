// Piezas de la pantalla Cobros y egresos: resumen del día, acciones y detalle de ítems de cuentas por pagar.
import { Plus, Link2, PackagePlus, Trash2, BarChart2 } from "lucide-react"
import { deleteWithUndo } from "@/lib/confirm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fmtMoney as fmt, hoyISO } from "@/lib/format"
import { Cobro, Egreso, CxP, CxPItem, ProductoMin } from "@/pages/cobros/tipos"

export function ResumenDiario({ cobros, egresos }: { cobros: Cobro[]; egresos: Egreso[] }) {
  const hoy = hoyISO()
  const cobrosHoy = cobros.filter(c => c.fecha === hoy)
  const egresosHoy = egresos.filter(e => e.fecha === hoy)
  const totalCobrosHoy = cobrosHoy.reduce((s, c) => s + Number(c.monto), 0)
  const totalEgresosHoy = egresosHoy.reduce((s, e) => s + Number(e.monto), 0)
  const neto = totalCobrosHoy - totalEgresosHoy

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground" /> Resumen del día — {hoy}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Cobros hoy</p>
            <p className="text-lg font-bold text-green-600">{fmt(totalCobrosHoy)}</p>
            <p className="text-xs text-muted-foreground">{cobrosHoy.length} transacciones</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Egresos hoy</p>
            <p className="text-lg font-bold text-amber-600">{fmt(totalEgresosHoy)}</p>
            <p className="text-xs text-muted-foreground">{egresosHoy.length} transacciones</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Neto del día</p>
            <p className={`text-lg font-bold ${neto >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(neto)}</p>
            <p className="text-xs text-muted-foreground">{neto >= 0 ? "↑ positivo" : "↓ negativo"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CxPAcciones({ c, rol, onPagar, onEliminar }: {
  c: CxP; rol: string | undefined
  onPagar: () => void; onEliminar: () => void
}) {
  return (
    <div className="flex gap-1 items-center">
      {c.estado !== "pagado" && (rol === "admin" || rol === "cajero") && (
        <Button variant="outline" size="sm" onClick={onPagar}>Pagar</Button>
      )}
      {rol === "admin" && c.monto_pagado === 0 && (
        <button
          onClick={() => deleteWithUndo(`CxP de ${c.proveedor} eliminada`, onEliminar)}
          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function CxPItemsPanel({ items, productos, onCrearProd, onEliminar, onAgregar }: {
  items: CxPItem[]
  productos: ProductoMin[]
  onCrearProd: (it: CxPItem) => void
  onEliminar: (itemId: number) => void
  onAgregar: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ítems de la factura</p>
        <button onClick={onAgregar} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <Plus className="h-3 w-3" /> Agregar ítem
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sin ítems — usa "Agregar ítem" para desglosarlos manualmente.</p>
      )}
      {/* Mobile: list */}
      <div className="md:hidden space-y-2">
        {items.map(it => {
          const prod = productos.find(p => p.id === it.producto_id)
          return (
            <div key={it.id} className="text-xs border rounded p-2 space-y-1">
              <div className="flex items-start justify-between gap-1">
                <div>
                  {it.codigo_proveedor && <span className="font-mono text-muted-foreground mr-1">[{it.codigo_proveedor}]</span>}
                  <span>{it.descripcion}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium">{fmt(it.subtotal)}</span>
                  <button onClick={() => onEliminar(it.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-muted-foreground">Cant: {it.cantidad} × {fmt(it.precio_unitario)}</div>
              {prod ? (
                <span className="inline-flex items-center gap-1 text-green-700"><Link2 className="h-3 w-3" />{prod.nombre}</span>
              ) : (
                <button onClick={() => onCrearProd(it)} className="inline-flex items-center gap-1 text-amber-600 underline">
                  <PackagePlus className="h-3 w-3" />Crear producto
                </button>
              )}
            </div>
          )
        })}
      </div>
      {/* Desktop: table */}
      {items.length > 0 && (
      <table className="hidden md:table w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left py-1 pr-3">Código prov.</th>
            <th className="text-left py-1 pr-3">Descripción</th>
            <th className="text-right py-1 pr-3">Cant.</th>
            <th className="text-right py-1 pr-3">P.Unit.</th>
            <th className="text-right py-1 pr-3">Subtotal</th>
            <th className="text-left py-1">Producto inventario</th>
            <th className="py-1 w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-muted">
          {items.map(it => {
            const prod = productos.find(p => p.id === it.producto_id)
            return (
              <tr key={it.id}>
                <td className="py-1.5 pr-3 font-mono text-muted-foreground">{it.codigo_proveedor ?? "—"}</td>
                <td className="py-1.5 pr-3">{it.descripcion}</td>
                <td className="py-1.5 pr-3 text-right">{it.cantidad}</td>
                <td className="py-1.5 pr-3 text-right">{fmt(it.precio_unitario)}</td>
                <td className="py-1.5 pr-3 text-right font-medium">{fmt(it.subtotal)}</td>
                <td className="py-1.5">
                  {prod ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <Link2 className="h-3 w-3" />{prod.nombre}{prod.codigo ? ` [${prod.codigo}]` : ""}
                    </span>
                  ) : (
                    <button onClick={() => onCrearProd(it)}
                      className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 underline">
                      <PackagePlus className="h-3 w-3" />Crear producto
                    </button>
                  )}
                </td>
                <td className="py-1.5">
                  <button onClick={() => onEliminar(it.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      )}
    </div>
  )
}
