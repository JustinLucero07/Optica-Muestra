// "Dra. Lucía Andrade" → "Lucía" (no saludar con el título)
const TITULOS = /^(dr|dra|lic|ing|sr|sra|srta|opt|mgs|msc|tlgo|tlga)\.?$/i

export function primerNombre(nombre?: string | null): string {
  const partes = (nombre ?? "").trim().split(/\s+/).filter(Boolean)
  return partes.find(p => !TITULOS.test(p)) ?? partes[0] ?? ""
}
