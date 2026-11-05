import { useState } from "react"
import { toast } from "sonner"
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react"
import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { useAuthStore } from "@/store/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"

/**
 * Cambio de contraseña del propio usuario.
 * `forzado`: la contraseña es temporal (la puso el admin) → no se puede cerrar
 * hasta cambiarla; la única salida es cerrar sesión.
 */
export default function CambiarPasswordDialog({ open, forzado, onClose }: { open: boolean; forzado: boolean; onClose: () => void }) {
  const { updateUser, logout } = useAuthStore()
  const [actual, setActual] = useState("")
  const [nueva, setNueva] = useState("")
  const [repetir, setRepetir] = useState("")
  const [ver, setVer] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const errores: string[] = []
  if (nueva && nueva.length < 8) errores.push("Mínimo 8 caracteres")
  if (nueva && (/^\d+$/.test(nueva) || /^[^\d]+$/.test(nueva))) errores.push("Combina letras y números")
  if (repetir && nueva !== repetir) errores.push("Las contraseñas nuevas no coinciden")
  const valido = actual && nueva && repetir && errores.length === 0

  function cerrar() {
    if (forzado) return
    setActual(""); setNueva(""); setRepetir("")
    onClose()
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!valido) return
    setGuardando(true)
    try {
      await api.post("/auth/cambiar-password", { actual, nueva })
      updateUser({ debe_cambiar_password: false })
      toast.success("Contraseña actualizada")
      setActual(""); setNueva(""); setRepetir("")
      onClose()
    } catch (err) {
      toast.error(errMsg(err, "No se pudo cambiar la contraseña"))
    } finally {
      setGuardando(false)
    }
  }

  const tipo = ver ? "text" : "password"
  return (
    <Dialog open={open} onClose={cerrar} className="max-w-md">
      <form onSubmit={guardar}>
        <DialogHeader onClose={forzado ? undefined : cerrar}>
          <span className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> {forzado ? "Crea tu contraseña" : "Cambiar mi contraseña"}</span>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {forzado && (
            <p className="text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-3 py-2">
              Estás usando una contraseña temporal. Por seguridad, elige una propia antes de continuar.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pw-actual">{forzado ? "Contraseña temporal" : "Contraseña actual"}</Label>
            <Input id="pw-actual" type={tipo} autoComplete="current-password" value={actual} onChange={e => setActual(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-nueva">Contraseña nueva</Label>
            <div className="relative">
              <Input id="pw-nueva" type={tipo} autoComplete="new-password" value={nueva} onChange={e => setNueva(e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setVer(v => !v)} title={ver ? "Ocultar" : "Mostrar"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Al menos 8 caracteres, con letras y números.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-repetir">Repite la contraseña nueva</Label>
            <Input id="pw-repetir" type={tipo} autoComplete="new-password" value={repetir} onChange={e => setRepetir(e.target.value)} />
          </div>
          {errores.length > 0 && <ul className="text-xs text-red-600 space-y-0.5">{errores.map(er => <li key={er}>• {er}</li>)}</ul>}
        </DialogBody>
        <DialogFooter>
          {forzado
            ? <Button type="button" variant="ghost" onClick={logout}>Cerrar sesión</Button>
            : <Button type="button" variant="outline" onClick={cerrar}>Cancelar</Button>}
          <Button type="submit" disabled={!valido || guardando}>
            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Guardar contraseña
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
