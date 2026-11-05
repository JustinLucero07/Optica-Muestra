import { lazy, type ComponentType } from "react"

const CLAVE = "optica-recarga-chunk"

/**
 * React.lazy con un reintento: si después de actualizar el sistema el navegador
 * pide un archivo de pantalla que ya no existe (versión vieja en memoria), se
 * recarga la página UNA vez para traer la versión nueva en lugar de mostrar error.
 */
export function lazyPage<T extends ComponentType<any>>(cargar: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await cargar()
      try { sessionStorage.removeItem(CLAVE) } catch { /* */ }
      return mod
    } catch (err) {
      let yaRecargo = false
      try { yaRecargo = sessionStorage.getItem(CLAVE) === "1" } catch { /* */ }
      if (!yaRecargo) {
        try { sessionStorage.setItem(CLAVE, "1") } catch { /* */ }
        window.location.reload()
        return new Promise<{ default: T }>(() => {})  // la recarga toma el control
      }
      throw err
    }
  })
}
