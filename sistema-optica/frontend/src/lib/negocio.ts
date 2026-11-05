// ─── Datos del negocio ───────────────────────────────────────────────────────
// Se cargan desde Configuración (tabla configuraciones) al iniciar sesión.
// Así ningún documento, PDF o mensaje lleva datos fijos en el código.

export interface DatosNegocio {
  nombre: string
  direccion: string
  telefono: string
  telefono2: string
}

const DEFAULT: DatosNegocio = {
  nombre: "Óptica",
  direccion: "",
  telefono: "",
  telefono2: "",
}

let datos: DatosNegocio = { ...DEFAULT }

export function setDatosNegocio(cfg: Record<string, string> | null | undefined) {
  if (!cfg) return
  datos = {
    nombre: (cfg.nombre_optica || "").trim() || DEFAULT.nombre,
    direccion: (cfg.direccion_optica || "").trim(),
    telefono: (cfg.telefono_optica || "").trim(),
    telefono2: (cfg.telefono_optica_2 || "").trim(),
  }
}

export function getNegocio(): DatosNegocio {
  return datos
}

/** "Nombre\nDirección" — firma corta para mensajes de WhatsApp. */
export function firmaNegocio(): string {
  return [datos.nombre, datos.direccion].filter(Boolean).join("\n")
}
