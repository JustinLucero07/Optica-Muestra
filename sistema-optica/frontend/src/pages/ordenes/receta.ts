// Conversión entre el formulario de receta (Rx) y el texto que se guarda en la orden.
import { parsePrescripcion } from "@/lib/rx"
import { RxOjo, RxForm } from "@/pages/ordenes/tipos"

export function rxToDesc(rx: RxForm): string {
  const fmtOjo = (label: string, o: RxOjo) => {
    const parts: string[] = []
    if (o.esf) parts.push(`Esf ${o.esf}`)
    if (o.cil) parts.push(`Cil ${o.cil}`)
    if (o.eje) parts.push(`Eje ${o.eje}`)
    if (o.add) parts.push(`Add ${o.add}`)
    if (o.prisma) parts.push(`Prisma ${o.prisma}`)
    if (o.dnp) parts.push(`DNP ${o.dnp}`)
    return parts.length ? `${label}: ${parts.join("  ")}` : ""
  }
  const lines: string[] = []
  const od = fmtOjo("OD", rx.od); if (od) lines.push(od)
  const oi = fmtOjo("OI", rx.oi); if (oi) lines.push(oi)
  if (rx.dp) lines.push(`DP: ${rx.dp}mm`)
  if (rx.material) lines.push(`Material: ${rx.material}`)
  if (rx.tratamiento) lines.push(`Tratamiento: ${rx.tratamiento}`)
  if (rx.diseno) lines.push(`Diseño: ${rx.diseno}`)
  if (rx.diagnostico) lines.push(`Diagnóstico: ${rx.diagnostico}`)
  if (rx.recomendaciones) lines.push(`Recomendaciones: ${rx.recomendaciones}`)
  return lines.join("\n")
}

export function descToRx(desc: string): RxForm {
  const p = parsePrescripcion(desc)
  return {
    od: { esf: p.od.esf, cil: p.od.cil, eje: p.od.eje, add: p.od.add, prisma: p.od.prisma, dnp: p.od.dnp },
    oi: { esf: p.oi.esf, cil: p.oi.cil, eje: p.oi.eje, add: p.oi.add, prisma: p.oi.prisma, dnp: p.oi.dnp },
    dp: p.dp, material: p.material, tratamiento: p.tratamiento, diseno: p.diseno,
    diagnostico: p.diagnostico, recomendaciones: p.recomendaciones,
  }
}
