/**
 * Exportación a Excel (.xlsx real) sin dependencias.
 *
 * Genera un libro con una hoja: encabezados en negrita, números como números
 * (se pueden sumar en Excel), montos con formato $ y fechas como fechas.
 * El .xlsx es un ZIP con XML; aquí se arma un ZIP "sin compresión", que Excel,
 * LibreOffice y Google Sheets abren sin problema.
 */

export type TipoColumna = "texto" | "numero" | "moneda" | "fecha"

export interface ColumnaExcel<T> {
  titulo: string
  valor: (fila: T) => string | number | null | undefined
  tipo?: TipoColumna
  ancho?: number // en caracteres; si se omite se calcula
}

// ── XML de la hoja ────────────────────────────────────────────────────────────
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
   // caracteres de control no válidos en XML
   .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")

function letraColumna(i: number): string {
  let s = ""
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s
  return s
}

/** "2026-11-05" → número de serie de Excel (días desde 1899-12-30). */
function serialFecha(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3])
  return Math.round(utc / 86_400_000) + 25569
}

// Estilos: 0 normal · 1 encabezado · 2 moneda · 3 fecha · 4 número
const ESTILO: Record<TipoColumna, number> = { texto: 0, moneda: 2, fecha: 3, numero: 4 }

function celda(ref: string, v: unknown, tipo: TipoColumna): string {
  if (v === null || v === undefined || v === "") return ""
  if (tipo === "fecha") {
    const n = typeof v === "string" ? serialFecha(v) : null
    if (n !== null) return `<c r="${ref}" s="3"><v>${n}</v></c>`
  } else if (tipo !== "texto") {
    const n = typeof v === "number" ? v : Number(v)
    if (Number.isFinite(n)) return `<c r="${ref}" s="${ESTILO[tipo]}"><v>${n}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`
}

function hojaXml<T>(columnas: ColumnaExcel<T>[], filas: T[]): string {
  const anchos = columnas.map((c, i) => {
    if (c.ancho) return c.ancho
    let max = c.titulo.length
    for (const f of filas.slice(0, 500)) max = Math.max(max, String(columnas[i].valor(f) ?? "").length)
    return Math.min(60, Math.max(10, max + 2))
  })
  const cols = anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")
  const encabezado = `<row r="1">${columnas.map((c, i) =>
    `<c r="${letraColumna(i)}1" s="1" t="inlineStr"><is><t>${esc(c.titulo)}</t></is></c>`).join("")}</row>`
  const cuerpo = filas.map((f, r) =>
    `<row r="${r + 2}">${columnas.map((c, i) => celda(`${letraColumna(i)}${r + 2}`, c.valor(f), c.tipo ?? "texto")).join("")}</row>`
  ).join("")
  const ultima = `${letraColumna(columnas.length - 1)}${filas.length + 1}`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols><sheetData>${encabezado}${cuerpo}</sheetData>
<autoFilter ref="A1:${ultima}"/></worksheet>`
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="#,##0.##"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="5"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/><xf numFmtId="166" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function archivos(nombreHoja: string, hoja: string): [string, string][] {
  return [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(nombreHoja.replace(/[\\/?*[\]:]/g, " ").slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets>
<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${esc(nombreHoja.slice(0, 31))}'!$A$1</definedName></definedNames>
</workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`],
    ["xl/worksheets/sheet1.xml", hoja],
    ["xl/styles.xml", ESTILOS],
  ]
}

// ── ZIP sin compresión ────────────────────────────────────────────────────────
const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zip(entradas: [string, string][]): Blob {
  const enc = new TextEncoder()
  const partes: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const [nombre, texto] of entradas) {
    const nom = enc.encode(nombre)
    const datos = enc.encode(texto)
    const crc = crc32(datos)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true)
    local.setUint16(8, 0, true); local.setUint16(10, 0, true); local.setUint16(12, 0x21, true)
    local.setUint32(14, crc, true); local.setUint32(18, datos.length, true); local.setUint32(22, datos.length, true)
    local.setUint16(26, nom.length, true); local.setUint16(28, 0, true)
    partes.push(new Uint8Array(local.buffer), nom, datos)

    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true)
    cen.setUint16(10, 0, true); cen.setUint16(12, 0, true); cen.setUint16(14, 0x21, true)
    cen.setUint32(16, crc, true); cen.setUint32(20, datos.length, true); cen.setUint32(24, datos.length, true)
    cen.setUint16(28, nom.length, true); cen.setUint32(42, offset, true)
    central.push(new Uint8Array(cen.buffer), nom)
    offset += 30 + nom.length + datos.length
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, entradas.length, true); fin.setUint16(10, entradas.length, true)
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true)
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)] as BlobPart[], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

/** Descarga un .xlsx con las filas dadas. `archivo` sin extensión (se agrega la fecha). */
export function crearExcel<T>(hoja: string, columnas: ColumnaExcel<T>[], filas: T[]): Blob {
  return zip(archivos(hoja, hojaXml(columnas, filas)))
}

export function exportExcel<T>(archivo: string, hoja: string, columnas: ColumnaExcel<T>[], filas: T[]): void {
  const blob = crearExcel(hoja, columnas, filas)
  const hoy = new Date()
  const sufijo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${archivo}_${sufijo}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
