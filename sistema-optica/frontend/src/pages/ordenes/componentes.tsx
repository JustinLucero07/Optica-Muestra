// Piezas de interfaz reutilizadas en la pantalla de órdenes: estado, menú de estados y buscador de productos.
import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { fmtMoney } from "@/lib/format"
import { estadoLabel } from "@/lib/estados"
import { ProductoMin, ESTADO_BADGE_CLASS } from "@/pages/ordenes/tipos"

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function EstadoPill({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE_CLASS[estado] ?? "bg-gray-100 text-gray-700"}`}>
      {estadoLabel(estado)}
    </span>
  )
}

export interface EstadoDropdownPortalProps {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  estados: string[]
  current: string
  onSelect: (s: string) => void
}
export function EstadoDropdownPortal({ anchorEl, open, onClose, estados, current, onSelect }: EstadoDropdownPortalProps) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (open && anchorEl) {
      const r = anchorEl.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width })
    }
  }, [open, anchorEl])

  if (!open) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9990]" onClick={onClose} />
      <div
        className="absolute z-[9991] bg-white dark:bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-[170px]"
        style={{ top: pos.top, left: pos.left }}
      >
        {estados.map(s => (
          <button
            key={s}
            className={`flex items-center gap-2.5 w-full text-left px-3 py-1.5 transition-colors rounded-lg ${s === current ? "bg-muted" : "hover:bg-muted"}`}
            style={{ width: "calc(100% - 8px)", margin: "0 4px" }}
            onClick={() => { onSelect(s); onClose() }}
          >
            <EstadoPill estado={s} />
            {s === current && <span className="ml-auto text-primary text-xs font-bold">✓</span>}
          </button>
        ))}
      </div>
    </>,
    document.body
  )
}

export function ProductoPicker({
  productos, value, onSelect, onCrearNuevo, placeholder = "Buscar por código o nombre…",
}: {
  productos: ProductoMin[]
  value: string
  onSelect: (p: ProductoMin) => void
  onCrearNuevo: (nombre: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const selected = value ? productos.find(p => p.id === Number(value)) : null
  const filtered = (search
    ? productos.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.codigo ?? "").toLowerCase().includes(search.toLowerCase()))
    : productos
  ).slice(0, 30)

  return (
    <div className="relative">
      <div
        onClick={() => setOpen(o => !o)}
        className="border border-input rounded-lg px-3 py-2 text-sm bg-background cursor-pointer flex items-center justify-between gap-2 mt-1"
      >
        {selected ? (
          <span className="truncate">{selected.nombre}{selected.codigo ? ` [${selected.codigo}]` : ""}</span>
        ) : (
          <span className="text-muted-foreground truncate">{placeholder}</span>
        )}
        <span className="text-muted-foreground shrink-0">▾</span>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full left-0 right-0 mt-1 border border-border rounded-lg shadow-xl bg-card max-h-64 overflow-y-auto">
            <div className="p-2 border-b sticky top-0 bg-card">
              <Input autoFocus placeholder="Código o nombre…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm" />
            </div>
            {filtered.map(p => (
              <button
                key={p.id} type="button"
                onClick={() => { onSelect(p); setOpen(false); setSearch("") }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2"
              >
                <span className="truncate">{p.nombre}{p.codigo ? ` [${p.codigo}]` : ""}</span>
                <span className="text-muted-foreground shrink-0">{fmtMoney((p.precio_venta ?? 0))}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground text-center">Sin resultados</p>}
            {search.trim() && (
              <button
                type="button"
                onClick={() => { onCrearNuevo(search.trim()); setOpen(false); setSearch("") }}
                className="w-full text-left px-3 py-1.5 text-sm text-primary hover:bg-accent transition-colors border-t"
              >
                + Crear producto "{search.trim()}"
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
