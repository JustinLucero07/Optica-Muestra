// Formulario de crear/editar orden de laboratorio (y el diálogo para agregar opciones nuevas de material/tratamiento/diseño).
import { Plus, Loader2, Trash2, PlusCircle, Stethoscope, Glasses, Eye, FileText, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogBody, DialogHeader, DialogFooter } from "@/components/ui/dialog"
import { fmtMoney } from "@/lib/format"
import PacienteCombobox from "@/components/PacienteCombobox"
import { RxOjo, newParte, TIPOS_ORDEN, PARTES_NOMBRES } from "@/pages/ordenes/tipos"
import { ProductoPicker } from "@/pages/ordenes/componentes"
import { type OrdenesCtx } from "@/pages/ordenes/useOrdenes"

export default function OrdenFormDialog({ ctx }: { ctx: OrdenesCtx }) {
  const {
    openForm,
    setOpenForm,
    editOrden,
    form,
    setForm,
    rx,
    setRx,
    partes,
    setPartes,
    precioItems,
    precioTotal,
    setPrecioItem,
    addPrecioItem,
    removePrecioItem,
    lunaEspecs,
    setLunaEspecs,
    armazonProductoId,
    setArmazonProductoId,
    lunaProductoId,
    setLunaProductoId,
    saving,
    consultaSelId,
    fuenteRx,
    setFuenteRx,
    proveedores,
    consultasDePaciente,
    productosMini,
    materialesLuna,
    indicesLuna,
    tratamientosLuna,
    materialesRx,
    tratamientosRx,
    disenosRx,
    dialogNuevaOpcion,
    setDialogNuevaOpcion,
    nuevaOpcionNombre,
    setNuevaOpcionNombre,
    crearOpcionLunaMut,
    crearProductoMut,
    cargarDesdeConsulta,
    setParteField,
    handleParteProveedorChange,
    handleParteProductoChange,
    handleParteFuente,
    handleSubmit,
  } = ctx

  return (
    <>
        {/* FORM DIALOG */}
        <Dialog open={openForm} onClose={() => setOpenForm(false)} className="max-w-5xl">
          <form onSubmit={handleSubmit} className={saving ? "pointer-events-none opacity-70" : ""}>
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {editOrden ? `Editar ${editOrden.numero}` : "Nueva orden de trabajo"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {editOrden ? "Modifica los datos de la orden" : "Completa los datos para crear la orden de laboratorio"}
                  </p>
                </div>
              </div>
            </div>

            <DialogBody className="p-0">
              <div className="divide-y divide-border">

                {/* ══ BLOQUE 1: DATOS GENERALES ══ */}
                <div className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shrink-0">1</div>
                    <span className="text-sm font-semibold text-foreground">Datos generales</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Paciente *</label>
                      <PacienteCombobox value={form.paciente_id} className="mt-1.5"
                        onChange={id => setForm(f => ({ ...f, paciente_id: id }))}
                        placeholder="Buscar por nombre o cédula…" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de orden *</label>
                      <select
                        className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background mt-1.5 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        value={form.tipo}
                        onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                      >
                        {TIPOS_ORDEN.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha de envío *</label>
                      <Input type="date" value={form.fecha_envio} onChange={e => setForm(f => ({ ...f, fecha_envio: e.target.value }))} required className="mt-1.5" />
                    </div>
                  </div>

                  {/* Cargar desde consulta */}
                  {!editOrden && form.paciente_id && (
                    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/70 dark:bg-sky-950/20 dark:border-sky-800 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Stethoscope className="h-4 w-4 text-sky-600" />
                        <span className="text-xs font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wide">
                          Importar prescripción desde consulta
                        </span>
                      </div>
                      {consultasDePaciente.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Este paciente no tiene consultas registradas.</p>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-sky-700 dark:text-sky-300 shrink-0 font-medium">Fuente:</span>
                            <div className="flex rounded-lg border border-sky-300 overflow-hidden text-xs font-medium shadow-sm">
                              {([
                                { key: "refraccion", label: "Refracción" },
                                { key: "lentes", label: "Lentes conv." },
                                { key: "contacto", label: "Contactología" },
                              ] as const).map((opt, i) => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  className={`px-3 py-1.5 transition-colors ${i > 0 ? "border-l border-sky-300" : ""} ${fuenteRx === opt.key ? "bg-sky-600 text-white" : "bg-white/60 text-sky-700 hover:bg-sky-100 dark:bg-transparent dark:text-sky-300"}`}
                                  onClick={() => {
                                    setFuenteRx(opt.key)
                                    if (consultaSelId) cargarDesdeConsulta(consultaSelId, opt.key)
                                  }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <select
                            className="w-full border border-sky-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-background"
                            value={consultaSelId}
                            onChange={e => cargarDesdeConsulta(e.target.value)}
                          >
                            <option value="">— Seleccionar consulta —</option>
                            {consultasDePaciente.map(c => {
                              const lc = c.recetas?.find(r => r.tipo === "lente_convencional")
                              const cl = c.recetas?.find(r => r.tipo === "contactologia")
                              const preview = fuenteRx === "refraccion"
                                ? [c.rx_od_esf != null ? `OD: ${Number(c.rx_od_esf) >= 0 ? "+" : ""}${c.rx_od_esf}` : "",
                                   c.rx_oi_esf != null ? `OI: ${Number(c.rx_oi_esf) >= 0 ? "+" : ""}${c.rx_oi_esf}` : ""].filter(Boolean).join(" / ")
                                : fuenteRx === "lentes"
                                ? lc ? [lc.lc_od_esf != null ? `OD: ${Number(lc.lc_od_esf) >= 0 ? "+" : ""}${lc.lc_od_esf}` : "",
                                         lc.lc_oi_esf != null ? `OI: ${Number(lc.lc_oi_esf) >= 0 ? "+" : ""}${lc.lc_oi_esf}` : ""].filter(Boolean).join(" / ")
                                      : "sin receta LC"
                                : cl ? [cl.cl_od_esf != null ? `OD: ${Number(cl.cl_od_esf) >= 0 ? "+" : ""}${cl.cl_od_esf}` : "",
                                         cl.cl_oi_esf != null ? `OI: ${Number(cl.cl_oi_esf) >= 0 ? "+" : ""}${cl.cl_oi_esf}` : ""].filter(Boolean).join(" / ")
                                      : "sin receta CL"
                              return (
                                <option key={c.id} value={c.id}>
                                  {c.numero} — {c.fecha}{preview ? ` | ${preview}` : ""}{c.diagnostico ? ` | ${c.diagnostico}` : ""}
                                </option>
                              )
                            })}
                          </select>
                          {consultaSelId && (
                            <div className="flex items-center gap-1.5 text-xs text-sky-700 dark:text-sky-300 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Prescripción cargada · cada parte usará los ojos seleccionados (OD / OI / Ambos)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ══ BLOQUE 2: PRESCRIPCIÓN ══ */}
                <div className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shrink-0">2</div>
                    <span className="text-sm font-semibold text-foreground">Prescripción óptica</span>
                  </div>

                  {/* Tabla RX */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <th className="px-3 py-2.5 font-semibold text-center border-r border-slate-200 dark:border-slate-700 w-14">Ojo</th>
                          {["ESF", "CIL", "EJE", "ADD", "PRISMA", "DNP"].map(h => (
                            <th key={h} className="px-2 py-2.5 font-semibold text-center border-r border-slate-200 dark:border-slate-700 last:border-r-0">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {(["od", "oi"] as const).map(ojo => (
                          <tr key={ojo} className="bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-3 py-2 font-bold text-center border-r border-slate-200 dark:border-slate-700">
                              <span className={`inline-flex items-center justify-center h-7 w-10 rounded-md text-xs font-bold ${ojo === "od" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"}`}>
                                {ojo.toUpperCase()}
                              </span>
                            </td>
                            {([
                              { f: "esf",    type: "number", step: "0.25",              placeholder: "±0.00" },
                              { f: "cil",    type: "number", step: "0.25",              placeholder: "±0.00" },
                              { f: "eje",    type: "number", step: "1",   min: "0", max: "180", placeholder: "0–180" },
                              { f: "add",    type: "number", step: "0.25", min: "0",    placeholder: "+0.00" },
                              { f: "prisma", type: "text",                              placeholder: "2Δ BU" },
                              { f: "dnp",    type: "number", step: "0.5",  min: "0",    placeholder: "mm" },
                            ] as { f: keyof RxOjo; type: string; step?: string; min?: string; max?: string; placeholder: string }[]).map(({ f, type, step, min, max, placeholder }, ci) => (
                              <td key={f} className={`px-1.5 py-1.5 border-r border-slate-100 dark:border-slate-700 ${ci === 5 ? "border-r-0" : ""}`}>
                                <input
                                  type={type}
                                  step={step}
                                  min={min}
                                  max={max}
                                  className="w-full px-2 py-1.5 text-center text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-primary/5 rounded-md transition-colors"
                                  value={rx[ojo][f as keyof RxOjo]}
                                  onChange={e => setRx(r => ({ ...r, [ojo]: { ...r[ojo], [f]: e.target.value } }))}
                                  placeholder={placeholder}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* DP + Material + Tratamiento + Diseño */}
                  <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,0.6fr)_repeat(3,minmax(0,1fr))] gap-3 mt-4">
                    {[
                      { label: "DP (mm)", content: <Input type="number" step="0.5" min="0" value={rx.dp} onChange={e => setRx(r => ({ ...r, dp: e.target.value }))} placeholder="63" className="text-center" /> },
                      { label: "Material", content: (
                        <div className="flex gap-1">
                          <select className="flex-1 w-0 px-3" value={rx.material} onChange={e => setRx(r => ({ ...r, material: e.target.value }))}>
                            <option value="">— Seleccionar —</option>
                            {(rx.material && !materialesRx.some(m => m.nombre === rx.material)
                              ? [...materialesRx, { id: -1, nombre: rx.material, activo: true }]
                              : materialesRx
                            ).map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                          </select>
                          <button type="button" title="Agregar material nuevo"
                            onClick={() => { setNuevaOpcionNombre(""); setDialogNuevaOpcion("rx_material") }}
                            className="h-10 w-10 shrink-0 rounded-md border border-input bg-background hover:bg-accent flex items-center justify-center">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )},
                      { label: "Tratamiento", content: (
                        <div className="flex gap-1">
                          <select className="flex-1 w-0 px-3" value={rx.tratamiento} onChange={e => setRx(r => ({ ...r, tratamiento: e.target.value }))}>
                            <option value="">— Seleccionar —</option>
                            {(rx.tratamiento && !tratamientosRx.some(t => t.nombre === rx.tratamiento)
                              ? [...tratamientosRx, { id: -1, nombre: rx.tratamiento, activo: true }]
                              : tratamientosRx
                            ).map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                          </select>
                          <button type="button" title="Agregar tratamiento nuevo"
                            onClick={() => { setNuevaOpcionNombre(""); setDialogNuevaOpcion("rx_tratamiento") }}
                            className="h-10 w-10 shrink-0 rounded-md border border-input bg-background hover:bg-accent flex items-center justify-center">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )},
                      { label: "Diseño", content: (
                        <div className="flex gap-1">
                          <select className="flex-1 w-0 px-3" value={rx.diseno} onChange={e => setRx(r => ({ ...r, diseno: e.target.value }))}>
                            <option value="">— Seleccionar —</option>
                            {(rx.diseno && !disenosRx.some(d => d.nombre === rx.diseno)
                              ? [...disenosRx, { id: -1, nombre: rx.diseno, activo: true }]
                              : disenosRx
                            ).map(d => <option key={d.id} value={d.nombre}>{d.nombre}</option>)}
                          </select>
                          <button type="button" title="Agregar diseño nuevo"
                            onClick={() => { setNuevaOpcionNombre(""); setDialogNuevaOpcion("rx_diseno") }}
                            className="h-10 w-10 shrink-0 rounded-md border border-input bg-background hover:bg-accent flex items-center justify-center">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )},
                    ].map(({ label, content }) => (
                      <div key={label} className="min-w-0">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
                        <div className="mt-1.5">{content}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Diagnóstico</label>
                      <Input value={rx.diagnostico} onChange={e => setRx(r => ({ ...r, diagnostico: e.target.value }))} placeholder="Miopía, Astigmatismo…" className="mt-1.5" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recomendaciones</label>
                      <Input value={rx.recomendaciones} onChange={e => setRx(r => ({ ...r, recomendaciones: e.target.value }))} placeholder="Uso permanente, lectura…" className="mt-1.5" />
                    </div>
                  </div>
                </div>

                {/* ══ BLOQUE 3: ARMAZÓN + LUNAS (lado a lado) ══ */}
                <div className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shrink-0">3</div>
                    <span className="text-sm font-semibold text-foreground">Armazón y lunas</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* Armazón */}
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Glasses className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Armazón</span>
                      </div>
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-xs text-muted-foreground">Producto del inventario</label>
                          <ProductoPicker
                            productos={productosMini}
                            value={armazonProductoId}
                            placeholder="Buscar armazón por código o nombre…"
                            onSelect={p => {
                              setArmazonProductoId(String(p.id))
                              setForm(f => ({ ...f, armazon_ref: p.nombre }))
                              setPrecioItem("arm", "monto", (p.precio_venta ?? 0).toFixed(2))
                            }}
                            onCrearNuevo={nombre => crearProductoMut.mutate({ nombre, tipo: "armazon" })}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Referencia / Modelo</label>
                          <Input placeholder="Ej: Ray-Ban RB3025" value={form.armazon_ref} onChange={e => setForm(f => ({ ...f, armazon_ref: e.target.value }))} className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Color</label>
                            <Input placeholder="Ej: Negro mate" value={form.armazon_color} onChange={e => setForm(f => ({ ...f, armazon_color: e.target.value }))} className="mt-1" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Talla</label>
                            <Input placeholder="52-18-140" value={form.armazon_talla} onChange={e => setForm(f => ({ ...f, armazon_talla: e.target.value }))} className="mt-1" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lunas */}
                    <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                        <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 uppercase tracking-wide">Especificaciones de lunas</span>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Producto del inventario</label>
                        <ProductoPicker
                          productos={productosMini}
                          value={lunaProductoId}
                          placeholder="Buscar luna por código o nombre…"
                          onSelect={p => {
                            setLunaProductoId(String(p.id))
                            setPrecioItem("lun", "monto", (p.precio_venta ?? 0).toFixed(2))
                          }}
                          onCrearNuevo={nombre => crearProductoMut.mutate({ nombre, tipo: "luna" })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Material</label>
                          <div className="flex gap-1 mt-1">
                            <select value={lunaEspecs.material} onChange={e => setLunaEspecs(s => ({ ...s, material: e.target.value }))}
                              className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm">
                              <option value="">— seleccionar —</option>
                              {(lunaEspecs.material && !materialesLuna.some(m => m.nombre === lunaEspecs.material)
                                ? [...materialesLuna, { id: -1, nombre: lunaEspecs.material, activo: true }]
                                : materialesLuna
                              ).map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                            </select>
                            <button type="button" title="Agregar material nuevo"
                              onClick={() => { setNuevaOpcionNombre(""); setDialogNuevaOpcion("luna_material") }}
                              className="h-10 w-10 shrink-0 rounded-md border border-input bg-background hover:bg-accent flex items-center justify-center">
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Índice</label>
                          <div className="flex gap-1 mt-1">
                            <select value={lunaEspecs.indice} onChange={e => setLunaEspecs(s => ({ ...s, indice: e.target.value }))}
                              className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm">
                              <option value="">— seleccionar —</option>
                              {(lunaEspecs.indice && !indicesLuna.some(m => m.nombre === lunaEspecs.indice)
                                ? [...indicesLuna, { id: -1, nombre: lunaEspecs.indice, activo: true }]
                                : indicesLuna
                              ).map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                            </select>
                            <button type="button" title="Agregar índice nuevo"
                              onClick={() => { setNuevaOpcionNombre(""); setDialogNuevaOpcion("luna_indice") }}
                              className="h-10 w-10 shrink-0 rounded-md border border-input bg-background hover:bg-accent flex items-center justify-center">
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Tratamientos</label>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {tratamientosLuna.map(op => {
                            const trat = op.nombre
                            const active = lunaEspecs.tratamientos.includes(trat)
                            return (
                              <button key={op.id} type="button"
                                onClick={() => setLunaEspecs(s => ({
                                  ...s,
                                  tratamientos: active ? s.tratamientos.filter(t => t !== trat) : [...s.tratamientos, trat],
                                }))}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${active ? "bg-cyan-600 text-white border-cyan-600 shadow-sm" : "bg-background text-muted-foreground border-input hover:border-cyan-400 hover:text-cyan-600"}`}
                              >
                                {active && <span className="mr-1">✓</span>}{trat}
                              </button>
                            )
                          })}
                          <button type="button"
                            onClick={() => { setNuevaOpcionNombre(""); setDialogNuevaOpcion("luna_tratamiento") }}
                            className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-cyan-400 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition-colors"
                          >
                            <Plus className="h-3 w-3 inline mr-0.5" /> Nuevo
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Color / Tinte</label>
                          <Input placeholder="Gris, Marrón, Claro…" value={lunaEspecs.color} onChange={e => setLunaEspecs(s => ({ ...s, color: e.target.value }))} className="mt-1 h-8 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Diámetro</label>
                          <Input placeholder="65mm, 70mm…" value={lunaEspecs.diametro} onChange={e => setLunaEspecs(s => ({ ...s, diametro: e.target.value }))} className="mt-1 h-8 text-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ══ BLOQUE 4: PROVEEDOR / LABORATORIO ══ */}
                <div className="px-6 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shrink-0">4</div>
                      <span className="text-sm font-semibold text-foreground">
                        Proveedor / Laboratorio
                        {partes.length > 1 && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">— se crearán {partes.length} órdenes separadas</span>
                        )}
                      </span>
                    </div>
                    {!editOrden && (
                      <button type="button" onClick={() => setPartes(ps => [...ps, newParte("")])}
                        className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 rounded-lg px-3 py-1.5 transition-colors">
                        <PlusCircle className="h-3.5 w-3.5" /> Agregar proveedor
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {partes.map((parte) => (
                      <div key={parte._id}
                        className={`rounded-xl border p-4 space-y-3 transition-colors ${parte.fuente === "stock" ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-700" : "bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800"}`}>

                        {/* Sub-header */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {partes.length > 1 ? (
                              <select
                                className="border rounded-lg px-2 py-1 text-xs bg-background font-semibold"
                                value={parte.nombre}
                                onChange={e => setParteField(parte._id, "nombre", e.target.value)}
                              >
                                {PARTES_NOMBRES.map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            ) : (
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {parte.fuente === "stock" ? "Desde stock propio" : "Laboratorio externo"}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-auto">
                            {/* Ojos */}
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Ojo:</span>
                              <div className="flex rounded-lg border overflow-hidden text-xs font-semibold shadow-sm">
                                {(["od", "oi", "ao"] as const).map((o, i) => (
                                  <button key={o} type="button"
                                    className={`px-2.5 py-1 transition-colors ${i > 0 ? "border-l" : ""} ${parte.ojos === o ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                    onClick={() => setParteField(parte._id, "ojos", o)}>
                                    {o === "ao" ? "Ambos" : o.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* Fuente */}
                            <div className="flex rounded-lg border overflow-hidden text-xs font-semibold shadow-sm">
                              <button type="button"
                                className={`px-3 py-1 transition-colors ${parte.fuente === "lab" ? "bg-violet-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                onClick={() => handleParteFuente("lab", parte._id)}>
                                Lab
                              </button>
                              <button type="button"
                                className={`px-3 py-1 transition-colors border-l ${parte.fuente === "stock" ? "bg-emerald-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                onClick={() => handleParteFuente("stock", parte._id)}>
                                Stock
                              </button>
                            </div>
                            {partes.length > 1 && (
                              <button type="button" className="text-red-400 hover:text-red-600 p-1" onClick={() => setPartes(ps => ps.filter(p => p._id !== parte._id))}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Producto del inventario */}
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            {parte.fuente === "stock" ? "Producto del inventario *" : "Vincular producto del inventario (opcional)"}
                          </label>
                          <select
                            className="w-full border rounded-lg px-3 py-2 text-sm bg-background mt-1"
                            value={parte.producto_id}
                            onChange={e => handleParteProductoChange(e.target.value, parte._id)}
                          >
                            <option value="">— Sin producto vinculado —</option>
                            {productosMini.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} — Stock: {Math.floor(p.stock_actual ?? 0)} | Costo: ${(p.precio_costo ?? 0).toFixed(2)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Campos lab */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {parte.fuente === "lab" && editOrden && (
                            <>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Proveedor del sistema</label>
                                <select
                                  className="w-full border rounded-lg px-2 py-2 text-sm bg-background mt-1"
                                  value={parte.proveedor_id}
                                  onChange={e => handleParteProveedorChange(e.target.value, parte._id)}
                                >
                                  <option value="">— Texto libre —</option>
                                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Nombre del laboratorio</label>
                                <Input value={parte.lab_proveedor === "Pendiente" ? "" : parte.lab_proveedor} onChange={e => setParteField(parte._id, "lab_proveedor", e.target.value)} placeholder="Nombre del lab" className="mt-1" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">WhatsApp del lab</label>
                                <Input value={parte.lab_telefono} onChange={e => setParteField(parte._id, "lab_telefono", e.target.value)} placeholder="0999123456" className="mt-1" />
                              </div>
                            </>
                          )}
                          {parte.fuente === "lab" && !editOrden && (
                            <div className="col-span-2 sm:col-span-3 rounded-lg border border-dashed border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20 px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
                              El laboratorio proveedor se asigna después, editando la orden cuando esté lista para enviarse.
                            </div>
                          )}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Entrega estimada</label>
                            <Input type="date" value={parte.fecha_entrega_est} onChange={e => setParteField(parte._id, "fecha_entrega_est", e.target.value)} className="mt-1" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">{parte.fuente === "stock" ? "Precio costo ($)" : "Precio lab ($)"}</label>
                            <Input type="number" step="0.01" min="0" value={parte.precio_lab} onChange={e => setParteField(parte._id, "precio_lab", e.target.value)} placeholder="0.00" className="mt-1" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ══ BLOQUE 5: PRECIOS AL CLIENTE ══ */}
                <div className="px-6 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shrink-0">5</div>
                      <span className="text-sm font-semibold text-foreground">Precios al cliente</span>
                    </div>
                    <button type="button" onClick={addPrecioItem}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Agregar ítem
                    </button>
                  </div>

                  <div className="rounded-xl border overflow-hidden">
                    {/* Header tabla */}
                    <div className="grid grid-cols-[1fr_140px_36px] gap-0 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                      <span>Concepto</span>
                      <span className="text-right pr-2">Precio</span>
                      <span />
                    </div>
                    {/* Filas */}
                    {precioItems.map((it, idx) => (
                      <div key={it.id} className="grid grid-cols-[1fr_140px_36px] gap-0 items-center border-b last:border-b-0 px-3 py-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <input
                          placeholder={idx === 0 ? "Armazón" : idx === 1 ? "Lunas" : "Concepto…"}
                          value={it.descripcion}
                          onChange={e => setPrecioItem(it.id, "descripcion", e.target.value)}
                          className="text-sm bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/50 focus:bg-blue-50/50 dark:focus:bg-blue-950/20 rounded px-1 py-0.5"
                        />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                          <input
                            type="number" step="0.01" min="0" placeholder="0.00"
                            value={it.monto}
                            onChange={e => setPrecioItem(it.id, "monto", e.target.value)}
                            className="w-full text-sm text-right pr-2 pl-6 py-1 bg-transparent border-none outline-none focus:bg-blue-50/50 dark:focus:bg-blue-950/20 rounded"
                          />
                        </div>
                        <div className="flex justify-center">
                          {precioItems.length > 1 && (
                            <button type="button" onClick={() => removePrecioItem(it.id)}
                              className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* Total */}
                    <div className="grid grid-cols-[1fr_140px_36px] items-center bg-primary/5 dark:bg-primary/10 px-4 py-3 border-t">
                      <span className="text-sm font-semibold text-foreground">Total</span>
                      <span className="text-right text-lg font-bold text-primary pr-2">
                        {precioTotal > 0 ? `${fmtMoney(precioTotal)}` : <span className="text-muted-foreground text-sm font-normal">—</span>}
                      </span>
                      <span />
                    </div>
                  </div>
                </div>

                {/* ══ BLOQUE 6: NOTAS ══ */}
                <div className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shrink-0">6</div>
                    <span className="text-sm font-semibold text-foreground">Notas internas</span>
                  </div>
                  <textarea
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-background resize-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    rows={2}
                    value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                    placeholder="Urgente · instrucciones especiales · observaciones para el lab…"
                  />
                  <div className="mt-3">
                    <label className="text-xs font-medium text-muted-foreground">N° referencia / factura</label>
                    <Input
                      value={form.referencia}
                      onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                      placeholder="Ej: 001-002-123456789"
                      className="mt-1"
                    />
                  </div>
                </div>

              </div>
            </DialogBody>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50/80 dark:bg-slate-900/50">
              <span className="text-xs text-muted-foreground">
                {editOrden ? "Los cambios se guardan en la orden existente" : partes.length > 1 ? `Se crearán ${partes.length} órdenes de trabajo` : "Se creará 1 orden de trabajo"}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="min-w-[130px]">
                  {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  {editOrden ? "Guardar cambios" : partes.length > 1 ? `Crear ${partes.length} órdenes` : "Crear orden"}
                </Button>
              </div>
            </div>
          </form>
        </Dialog>

        {/* Nueva opción (materiales / índices / tratamientos / diseños) */}
        <Dialog open={!!dialogNuevaOpcion} onClose={() => setDialogNuevaOpcion(null)} className="max-w-sm">
          <DialogHeader onClose={() => setDialogNuevaOpcion(null)}>
            {({
              luna_material: "Nuevo material",
              luna_indice: "Nuevo índice",
              luna_tratamiento: "Nuevo tratamiento",
              rx_material: "Nuevo material",
              rx_tratamiento: "Nuevo tratamiento",
              rx_diseno: "Nuevo diseño",
            } as Record<string, string>)[dialogNuevaOpcion ?? ""] ?? "Nueva opción"}
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault()
            if (nuevaOpcionNombre.trim() && dialogNuevaOpcion) crearOpcionLunaMut.mutate({ nombre: nuevaOpcionNombre.trim(), tipo: dialogNuevaOpcion })
          }}>
            <DialogBody className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nombre *</label>
                <Input
                  placeholder={dialogNuevaOpcion === "luna_indice" ? "Ej: 1.71" : "Ej: Nuevo material o tratamiento"}
                  value={nuevaOpcionNombre}
                  onChange={e => setNuevaOpcionNombre(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogNuevaOpcion(null)}>Cancelar</Button>
              <Button type="submit" disabled={crearOpcionLunaMut.isPending || !nuevaOpcionNombre.trim()}>
                {crearOpcionLunaMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Agregar y seleccionar
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
    </>
  )
}
