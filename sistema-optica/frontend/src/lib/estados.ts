// Texto legible para los estados que guarda el backend (siempre en minúscula y con "_").
// Un solo lugar para que todas las pantallas muestren lo mismo: "En proceso", no "en_proceso".

const ESTADOS: Record<string, string> = {
  // turnos
  pendiente: "Pendiente", confirmado: "Confirmado", asistido: "Asistió", no_asistio: "No asistió", cancelado: "Cancelado",
  // órdenes de laboratorio
  enviado: "Enviado", en_proceso: "En proceso", listo: "Listo", entregado: "Entregado", rechazado: "Rechazado",
  // ventas / cobros / créditos
  cobrado: "Cobrado", anulado: "Anulado", vigente: "Vigente", pagado: "Pagado", pagada: "Pagada",
  vencido: "Vencido", vencida: "Vencida", parcial: "Parcial",
  // presupuestos
  borrador: "Borrador", aceptado: "Aceptado", expirado: "Expirado", convertido: "Convertido",
  // caja
  abierta: "Abierta", cerrada: "Cerrada",
}

export function estadoLabel(estado?: string | null): string {
  if (!estado) return "—"
  const e = estado.toLowerCase()
  if (ESTADOS[e]) return ESTADOS[e]
  const t = e.replace(/_/g, " ")
  return t.charAt(0).toUpperCase() + t.slice(1)
}
