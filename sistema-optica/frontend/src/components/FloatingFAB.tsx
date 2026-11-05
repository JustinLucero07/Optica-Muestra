import { Plus, ShoppingBag, Calendar, Wallet, Users } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/auth"

// "?nuevo=1" hace que la página abra directamente su formulario de alta.
const ACTIONS = [
  { icon: ShoppingBag, label: "Nueva venta",    to: "/ventas/nueva",        roles: ["admin", "vendedor"] },
  { icon: Calendar,    label: "Nuevo turno",    to: "/turnos?nuevo=1",      roles: ["admin", "optometrista", "vendedor", "cajero"] },
  { icon: Wallet,      label: "Nuevo cobro",    to: "/cobros?nuevo=1",      roles: ["admin", "cajero", "vendedor"] },
  { icon: Users,       label: "Nuevo paciente", to: "/pacientes?nuevo=1",   roles: ["admin", "optometrista", "vendedor"] },
]

export default function FloatingFAB() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const rol = useAuthStore(s => s.user?.role) ?? ""
  const acciones = ACTIONS.filter(a => a.roles.includes(rol))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  function handleAction(to: string) {
    setOpen(false)
    navigate(to)
  }

  if (acciones.length === 0) return null

  return (
    <div ref={ref} className="hidden md:block fixed bottom-6 right-6 z-40">
      <div className="flex flex-col items-end gap-2">
        {open && (
          <div className="flex flex-col items-end gap-2 mb-1">
            {acciones.map(({ icon: Icon, label, to }) => (
              <button
                key={to}
                onClick={() => handleAction(to)}
                className="flex items-center gap-2 bg-card border shadow-md rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                <Icon className="h-4 w-4 text-primary shrink-0" />
                {label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen(v => !v)}
          aria-label="Acciones rápidas"
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all duration-200"
          style={{ boxShadow: "0 4px 24px hsl(var(--primary)/0.35)" }}
        >
          <Plus
            className="h-7 w-7 transition-transform duration-200"
            style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>
    </div>
  )
}
