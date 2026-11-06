// Documentos de la orden: PDF para el laboratorio, etiqueta, aceptación del paciente y envío por WhatsApp.
import { esc, getMarcaFooter, PDF_BASE_CSS, openPrintWindow, getMarcaLogo, downloadHtmlAsPdf } from "@/lib/pdf"
import { parsePrescripcion } from "@/lib/rx"
import { useBrandStore } from "@/store/brand"
import { getNegocio } from "@/lib/negocio"
import { fmtDate } from "@/lib/format"
import { Orden } from "@/pages/ordenes/tipos"

// ─── PDF: Orden para lab ──────────────────────────────────────────────────────
export function buildOrdenHtml(orden: Orden, pacNombre: string, logo?: string | null): string {
  const rx = parsePrescripcion(orden.descripcion)
  const fmtRxVal = (v: string) => {
    if (!v) return "—"
    const n = Number(v.replace(",", "."))
    if (isNaN(n)) return v
    return (n >= 0 ? "+" : "") + n.toFixed(2)
  }
  const c = (v: string) => `<td>${v || "—"}</td>`
  const cr = (v: string) => `<td>${fmtRxVal(v)}</td>`

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Orden ${orden.numero}</title>
  <style>
    ${PDF_BASE_CSS}
    @page{size:A4;margin:9mm}
    body{max-width:165mm!important;padding:0!important;font-size:10.5px!important;margin:0!important}
    .doc-hdr{margin-bottom:8px!important}
    .doc-hdr-title{font-size:9.5px!important}
    .doc-body{gap:6px!important}
    .doc-section{margin-bottom:6px!important}
    .doc-section-title{font-size:9px!important;margin-bottom:5px!important;padding-bottom:3px!important}
    table.rx th,table.rx td{padding:3px 4px!important;font-size:10px!important}
    .extras{display:flex;border:1px solid #e5e7eb;border-top:none}
    .extras>div{flex:1;padding:5px 8px;border-right:1px solid #e5e7eb;font-size:10px}
    .extras>div:last-child{border-right:none}
    .extras .l{color:#6b7280;font-size:9px;font-weight:700;text-transform:uppercase;margin-bottom:1px}
  </style></head><body>
  <div class="doc-hdr">
    <div class="doc-hdr-left">
      ${getMarcaLogo(logo)}
      <div class="doc-hdr-title">Orden de Trabajo — Lente Convencional</div>
    </div>
    <div class="doc-hdr-right">
      <div class="num">${orden.numero}</div>
      <div class="fecha">${fmtDate(orden.fecha_envio)}</div>
    </div>
  </div>
  <div class="doc-body">
    <div class="doc-section">
      <div class="doc-grid" style="grid-template-columns:80px 1fr 80px 1fr">
        <span class="lbl">Paciente</span><span class="val"><strong>${esc(pacNombre)}</strong></span>
        <span class="lbl">Laboratorio</span><span class="val"><strong>${orden.lab_proveedor}</strong></span>
        <span class="lbl">Tipo</span><span class="val">${orden.tipo}</span>
        <span class="lbl">Entrega est.</span><span class="val">${orden.fecha_entrega_est ? fmtDate(orden.fecha_entrega_est) : "—"}</span>
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-section-title">Prescripción</div>
      <table class="rx">
        <thead><tr>
          <th style="width:32px"></th>
          <th>ESF</th><th>CYL</th><th>EJE</th><th>ADD</th>
          <th>PRISMA</th><th>DNP</th><th>DP</th>
        </tr></thead>
        <tbody>
          <tr>
            <td class="eye">OD</td>
            ${cr(rx.od.esf)}${cr(rx.od.cil)}${c(rx.od.eje)}${cr(rx.od.add)}
            ${c(rx.od.prisma)}${c(rx.od.dnp)}${c(rx.od.dp || rx.dp)}
          </tr>
          <tr>
            <td class="eye">OI</td>
            ${cr(rx.oi.esf)}${cr(rx.oi.cil)}${c(rx.oi.eje)}${cr(rx.oi.add)}
            ${c(rx.oi.prisma)}${c(rx.oi.dnp)}${c(rx.oi.dp || rx.dp)}
          </tr>
        </tbody>
      </table>
    </div>
    <div class="extras">
      <div><div class="l">Diseño del lente</div>${esc(rx.diseno || "—")}</div>
      <div><div class="l">Tratamiento</div>${esc(rx.tratamiento || "—")}</div>
      <div><div class="l">Material</div>${esc(rx.material || "—")}</div>
    </div>
    ${rx.diagnostico ? `<div class="doc-section" style="margin-top:6px"><span style="font-weight:600;color:#374151">Diagnóstico: </span>${esc(rx.diagnostico)}</div>` : ""}
  </div>
  </body></html>`
}

export function printOrden(orden: Orden, pacNombre: string, logo?: string | null) {
  openPrintWindow(buildOrdenHtml(orden, pacNombre, logo), 820, 900, { cerrarAlImprimir: true })
}

// ─── PDF: Etiqueta de lente ───────────────────────────────────────────────────
export function printEtiqueta(orden: Orden, pacNombre: string) {
  const rx = parsePrescripcion(orden.descripcion)
  const fmtVal = (v: string | null | undefined) => {
    if (v == null || v === "") return null
    const n = parseFloat(v)
    if (isNaN(n)) return v
    return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
  }
  const odParts = [fmtVal(rx.od.esf), fmtVal(rx.od.cil), rx.od.eje ? `x${rx.od.eje}°` : null].filter(Boolean).join(" ")
  const oiParts = [fmtVal(rx.oi.esf), fmtVal(rx.oi.cil), rx.oi.eje ? `x${rx.oi.eje}°` : null].filter(Boolean).join(" ")

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Etiqueta ${orden.numero}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;width:90mm;height:50mm;padding:4mm;display:flex;flex-direction:column;justify-content:center;gap:2mm}
    .num{font-size:18px;font-weight:900;color:#0891b2;letter-spacing:1px}
    .pac{font-size:11px;font-weight:700;text-transform:uppercase}
    .rx{font-size:9px;line-height:1.6;color:#374151}
    .rx span{font-weight:bold;color:#0891b2;margin-right:4px}
    .footer{font-size:8px;color:#94a3b8;border-top:1px solid #e5e7eb;padding-top:2mm;margin-top:auto}
    @media print{@page{size:90mm 50mm;margin:0}body{padding:4mm}}
  </style></head><body>
  <div class="num">${orden.numero}</div>
  <div class="pac">${esc(pacNombre)}</div>
  <div class="rx">
    <div><span>OD:</span>${odParts || "—"}</div>
    <div><span>OI:</span>${oiParts || "—"}</div>
    ${rx.diseno ? `<div><span>Diseño:</span>${esc(rx.diseno)}</div>` : ""}
    ${rx.material ? `<div><span>Mat:</span>${esc(rx.material)}</div>` : ""}
  </div>
  <div class="footer">${esc(getNegocio().nombre)} · ${new Date().toLocaleDateString("es-EC")}</div>
  </body></html>`
  openPrintWindow(html, 400, 300, { cerrarAlImprimir: true })
}

// ─── PDF: Aceptación entrega de lentes ───────────────────────────────────────
export function printAceptacion(orden: Orden, pacNombre: string, firma = "", logo?: string | null) {
  const rx = parsePrescripcion(orden.descripcion)
  const fmtRxVal2 = (v: string) => { const n = Number(v.replace(",",".")); return !v ? "—" : isNaN(n) ? v : (n>=0?"+":"")+n.toFixed(2) }
  const c = (v: string) => `<td>${v || "—"}</td>`
  const cr = (v: string) => `<td>${fmtRxVal2(v)}</td>`

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Aceptación ${orden.numero}</title>
  <style>${PDF_BASE_CSS}</style></head><body>
  <div class="doc-hdr">
    <div class="doc-hdr-left">
      ${getMarcaLogo(logo)}
      <div class="doc-hdr-title">Formato de Aceptación — Entrega de Lentes</div>
    </div>
    <div class="doc-hdr-right">
      <div class="num">${orden.numero}</div>
      <div class="fecha">${new Date().toLocaleDateString("es-EC")}</div>
    </div>
  </div>
  <div class="doc-body">
    <div class="doc-section">
      <div class="doc-section-title">Datos del cliente</div>
      <div class="doc-grid">
        <span class="lbl">Paciente</span><span class="val"><strong>${esc(pacNombre)}</strong></span>
        <span class="lbl">Lab / Proveedor</span><span class="val">${orden.lab_proveedor}</span>
        <span class="lbl">Tipo de lente</span><span class="val">${orden.tipo}</span>
        <span class="lbl">Fecha de entrega</span><span class="val">${new Date().toLocaleDateString("es-EC")}</span>
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-section-title">Prescripción entregada</div>
      <table class="rx">
        <thead><tr>
          <th style="width:44px"></th>
          <th>ESF</th><th>CYL</th><th>EJE</th><th>ADD</th><th>PRISMA</th><th>DNP</th>
        </tr></thead>
        <tbody>
          <tr><td class="eye">OD</td>${cr(rx.od.esf)}${cr(rx.od.cil)}${c(rx.od.eje)}${cr(rx.od.add)}${c(rx.od.prisma)}${c(rx.od.dnp || rx.dp)}</tr>
          <tr><td class="eye">OI</td>${cr(rx.oi.esf)}${cr(rx.oi.cil)}${c(rx.oi.eje)}${cr(rx.oi.add)}${c(rx.oi.prisma)}${c(rx.oi.dnp || rx.dp)}</tr>
        </tbody>
      </table>
      <div class="doc-grid" style="margin-top:8px">
        ${rx.material ? `<span class="lbl">Material</span><span class="val">${esc(rx.material)}</span>` : ""}
        ${rx.tratamiento ? `<span class="lbl">Tratamiento</span><span class="val">${rx.tratamiento}</span>` : ""}
        ${rx.diseno ? `<span class="lbl">Diseño</span><span class="val">${esc(rx.diseno)}</span>` : ""}
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-section-title">Conformidad del cliente</div>
      <div class="check-item"><span class="check-box"></span> He recibido los lentes en perfectas condiciones y los he probado a mi satisfacción.</div>
      <div class="check-item"><span class="check-box"></span> Entiendo que los lentes han sido fabricados con la prescripción indicada y no presentan defecto de fabricación.</div>
      <div class="check-item"><span class="check-box"></span> Me han explicado el período de adaptación y los cuidados necesarios.</div>
      <div class="check-item"><span class="check-box"></span> Estoy conforme con el producto recibido y no tengo objeción al respecto.</div>
    </div>
    <div class="doc-section">
      <div class="firma-row">
        <div class="firma-box"><div class="line"></div><p>Firma del cliente</p></div>
        <div class="firma-box"><div class="line"></div><p>Cédula / Documento</p></div>
        <div class="firma-box">
          ${firma ? `<img src="${firma}" />` : `<div class="line"></div>`}
          <p>Responsable ${esc(getNegocio().nombre)}</p>
        </div>
      </div>
    </div>
  </div>
  ${getMarcaFooter(logo)}
  </body></html>`

  openPrintWindow(html, 780, 920)
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
export function fmtPhone(tel: string) {
  const digits = tel.replace(/\D/g, "")
  if (digits.startsWith("593")) return digits
  if (digits.startsWith("0")) return "593" + digits.slice(1)
  return "593" + digits
}

export function enviarAlLab(orden: Orden, pacNombre: string) {
  const tel = orden.lab_telefono
  if (!tel) return
  const rx = parsePrescripcion(orden.descripcion)
  const esUrgente = /urgente|urgencia/i.test(orden.notas ?? "")
  const ojosMatch = /Ojo:\s*(od|oi|ao)/i.exec(orden.notas ?? "")
  const ojos = (ojosMatch?.[1]?.toLowerCase() ?? "ao") as "od" | "oi" | "ao"

  const notasLimpias = (orden.notas ?? "")
    .split("|").map(s => s.trim())
    .filter(s => s && !/^(Ojo:|Fuente:|Producto:)/i.test(s))
    .join(" | ")

  const fmtOjo = (label: string, ojo: ReturnType<typeof parsePrescripcion>["od"]) => {
    const parts = [`ESF: ${ojo.esf || "pl"}`, `CIL: ${ojo.cil || "pl"}`]
    if (ojo.eje) parts.push(`EJE: ${ojo.eje}`)
    if (ojo.add) parts.push(`ADD: +${ojo.add}`)
    if (ojo.prisma) parts.push(`PRIS: ${ojo.prisma}`)
    if (ojo.dnp) parts.push(`DNP: ${ojo.dnp}mm`)
    return `${label}: ${parts.join("  ")}`
  }

  const rxLineas: string[] = []
  if (ojos === "od" || ojos === "ao") rxLineas.push(fmtOjo("OD", rx.od))
  if (ojos === "oi" || ojos === "ao") rxLineas.push(fmtOjo("OI", rx.oi))
  if (rx.dp) rxLineas.push(`DP: ${rx.dp}mm`)

  const lineas = [
    esUrgente ? "🔴 URGENTE 🔴" : "",
    `*${getNegocio().nombre.toUpperCase()}*`,
    `Orden: *${orden.numero}*  |  Fecha: ${fmtDate(orden.fecha_envio)}`,
    orden.fecha_entrega_est ? `Entrega solicitada: *${fmtDate(orden.fecha_entrega_est)}*` : "",
    ``,
    `Paciente: *${pacNombre}*`,
    `Tipo: ${orden.tipo}`,
    rx.material ? `Material: ${rx.material}` : "",
    rx.tratamiento ? `Tratamiento: ${rx.tratamiento}` : "",
    rx.diseno ? `Diseño: ${rx.diseno}` : "",
    ``,
    `*PRESCRIPCION:*`,
    ...rxLineas,
    ``,
    rx.diagnostico ? `Diagnostico: ${rx.diagnostico}` : "",
    notasLimpias ? `Notas: ${notasLimpias}` : "",
    ``,
    `Confirmar recepcion y tiempo de entrega, gracias.`,
    getNegocio().nombre,
  ].filter(v => v !== "")

  // Abrir WhatsApp con el texto
  window.open(`https://wa.me/${fmtPhone(tel)}?text=${encodeURIComponent(lineas.join("\n"))}`, "_blank")

  // Generar y descargar el PDF para adjuntar en el chat
  const logo = useBrandStore.getState().logo
  const htmlPdf = buildOrdenHtml(orden, pacNombre, logo)
  downloadHtmlAsPdf(htmlPdf, `${orden.numero}.pdf`)
    .then(() => {
      // toast shown separately so it appears after the download starts
    })
    .catch(console.error)
}
