// Estado, consultas y acciones de la pantalla de órdenes de laboratorio.
// La pantalla (Ordenes.tsx) y el formulario (OrdenFormDialog.tsx) comparten este mismo estado.
import { useState, useRef, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { useBrandStore } from "@/store/brand"
import { rangoMes } from "@/lib/format"
import { useAuthStore } from "@/store/auth"
import { Proveedor, Orden, ConsultaItem, ProductoMin, EMPTY_RX_OJO, RxForm, EMPTY_RX, OrdenParte, newParte, EMPTY_FORM } from "@/pages/ordenes/tipos"
import { rxToDesc, descToRx } from "@/pages/ordenes/receta"

export function useOrdenes() {
  const location = useLocation()
  const navigate = useNavigate()
  const [filtroEstado, setFiltroEstado] = useState("")
  const [filtroPaciente, setFiltroPaciente] = useState("")
  const [mesOffset, setMesOffset] = useState(0)
  const [filtroDesde, setFiltroDesde] = useState(() => rangoMes(0).desde)
  const [filtroHasta, setFiltroHasta] = useState(() => rangoMes(0).hasta)
  function irAMes(offset: number) {
    const r = rangoMes(offset)
    setMesOffset(offset)
    setFiltroDesde(r.desde)
    setFiltroHasta(r.hasta)
    setPage(1)
  }
  function verTodoMes() {
    setMesOffset(NaN)
    setFiltroDesde("")
    setFiltroHasta("")
    setPage(1)
  }
  const [vistaKanban, setVistaKanban] = useState(false)
  const [page, setPage] = useState(1)
  const [PER_PAGE, setPER_PAGE] = useState(20)
  const [openForm, setOpenForm] = useState(false)
  const [editOrden, setEditOrden] = useState<Orden | null>(null)
  const [form, setForm] = useState(() => {
    const pre = (location.state as any)?.fromPresupuesto
    if (pre) return { ...EMPTY_FORM, paciente_id: pre.paciente_id ? String(pre.paciente_id) : "", notas: pre.notas ?? "" }
    return { ...EMPTY_FORM }
  })
  // Presupuesto del que nace la orden: al guardar queda "convertido" (backend)
  const rolUsuario = useAuthStore(s => s.user?.role)
  const [presupuestoOrigen, setPresupuestoOrigen] = useState<{ id: number; numero: string } | null>(() => {
    const pre = (location.state as any)?.fromPresupuesto
    return pre?.id ? { id: pre.id, numero: pre.numero } : null
  })
  const [rx, setRx] = useState<RxForm>({ ...EMPTY_RX, od: { ...EMPTY_RX_OJO }, oi: { ...EMPTY_RX_OJO } })
  const [partes, setPartes] = useState<OrdenParte[]>([newParte()])
  const [precioItems, setPrecioItems] = useState<{ id: string; descripcion: string; monto: string }[]>([
    { id: "arm", descripcion: "Armazón", monto: "" },
    { id: "lun", descripcion: "Lunas", monto: "" },
  ])
  const precioTotal = precioItems.reduce((s, it) => s + (parseFloat(it.monto) || 0), 0)
  function setPrecioItem(id: string, field: "descripcion" | "monto", val: string) {
    setPrecioItems(items => items.map(it => it.id === id ? { ...it, [field]: val } : it))
  }
  function addPrecioItem() {
    setPrecioItems(items => [...items, { id: Date.now().toString(), descripcion: "", monto: "" }])
  }
  function removePrecioItem(id: string) {
    setPrecioItems(items => items.filter(it => it.id !== id))
  }
  const EMPTY_LUNA_ESPECS = { material: "", indice: "", tratamientos: [] as string[], color: "", diametro: "" }
  const [lunaEspecs, setLunaEspecs] = useState({ ...EMPTY_LUNA_ESPECS })
  const [armazonProductoId, setArmazonProductoId] = useState("")
  const [lunaProductoId, setLunaProductoId] = useState("")
  const [saving, setSaving] = useState(false)
  const [estadoDropdown, setEstadoDropdown] = useState<number | null>(null)
  const estadoAnchorRef = useRef<HTMLElement | null>(null)
  const [consultaSelId, setConsultaSelId] = useState("")
  const [fuenteRx, setFuenteRx] = useState<"refraccion" | "lentes" | "contacto">("refraccion")
  const qc = useQueryClient()

  const brandLogo = useBrandStore(s => s.logo)

  const { data: config } = useQuery({
    queryKey: ["configuracion"],
    queryFn: () => api.get("/configuracion").then(r => r.data),
    staleTime: 300_000,
  })
  const waCloudEnabled = config?.wa_mode === "cloud_api"

  const { data: ordenes = [], isLoading } = useQuery<Orden[]>({
    queryKey: ["ordenes", filtroEstado, filtroDesde, filtroHasta],
    queryFn: () =>
      api.get("/ordenes", { params: { estado: filtroEstado || undefined, desde: filtroDesde || undefined, hasta: filtroHasta || undefined, limit: 200 } }).then(r => r.data),
  })

  const { data: proveedores = [] } = useQuery<Proveedor[]>({
    queryKey: ["proveedores"],
    queryFn: () => api.get("/proveedores", { params: { activo: true } }).then(r => r.data),
  })

  const { data: consultasDePaciente = [] } = useQuery<ConsultaItem[]>({
    queryKey: ["consultas-paciente", form.paciente_id],
    queryFn: () => api.get(`/pacientes/${form.paciente_id}/consultas`).then(r => r.data),
    enabled: !!form.paciente_id && openForm,
    staleTime: 60_000,
  })

  const { data: productosMini = [] } = useQuery<ProductoMin[]>({
    queryKey: ["productos-mini"],
    queryFn: () => api.get("/productos", { params: { limit: 5000 } }).then(r => r.data),
    staleTime: 120_000,
  })

  const { data: categorias = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ["categorias"],
    queryFn: () => api.get("/categorias").then(r => r.data),
    staleTime: 300_000,
  })

  interface OpcionLuna { id: number; nombre: string; activo: boolean }
  const { data: materialesLuna = [] } = useQuery<OpcionLuna[]>({
    queryKey: ["luna-materiales"],
    queryFn: () => api.get("/referidos", { params: { tipo: "luna_material", activo: true } }).then(r => r.data),
    staleTime: 300_000,
  })
  const { data: indicesLuna = [] } = useQuery<OpcionLuna[]>({
    queryKey: ["luna-indices"],
    queryFn: () => api.get("/referidos", { params: { tipo: "luna_indice", activo: true } }).then(r => r.data),
    staleTime: 300_000,
  })
  const { data: tratamientosLuna = [] } = useQuery<OpcionLuna[]>({
    queryKey: ["luna-tratamientos"],
    queryFn: () => api.get("/referidos", { params: { tipo: "luna_tratamiento", activo: true } }).then(r => r.data),
    staleTime: 300_000,
  })
  const { data: materialesRx = [] } = useQuery<OpcionLuna[]>({
    queryKey: ["rx-materiales"],
    queryFn: () => api.get("/referidos", { params: { tipo: "rx_material", activo: true } }).then(r => r.data),
    staleTime: 300_000,
  })
  const { data: tratamientosRx = [] } = useQuery<OpcionLuna[]>({
    queryKey: ["rx-tratamientos"],
    queryFn: () => api.get("/referidos", { params: { tipo: "rx_tratamiento", activo: true } }).then(r => r.data),
    staleTime: 300_000,
  })
  const { data: disenosRx = [] } = useQuery<OpcionLuna[]>({
    queryKey: ["rx-disenos"],
    queryFn: () => api.get("/referidos", { params: { tipo: "rx_diseno", activo: true } }).then(r => r.data),
    staleTime: 300_000,
  })

  type TipoOpcion = "luna_material" | "luna_indice" | "luna_tratamiento" | "rx_material" | "rx_tratamiento" | "rx_diseno"
  const [dialogNuevaOpcion, setDialogNuevaOpcion] = useState<null | TipoOpcion>(null)
  const [nuevaOpcionNombre, setNuevaOpcionNombre] = useState("")

  const crearOpcionLunaMut = useMutation({
    mutationFn: ({ nombre, tipo }: { nombre: string; tipo: TipoOpcion }) => api.post("/referidos", { nombre, tipo }),
    onSuccess: (res, { tipo }) => {
      const nombre = res.data.nombre
      const invalidateMap: Record<TipoOpcion, string> = {
        luna_material: "luna-materiales", luna_indice: "luna-indices", luna_tratamiento: "luna-tratamientos",
        rx_material: "rx-materiales", rx_tratamiento: "rx-tratamientos", rx_diseno: "rx-disenos",
      }
      qc.invalidateQueries({ queryKey: [invalidateMap[tipo]] })
      if (tipo === "luna_material") setLunaEspecs(s => ({ ...s, material: nombre }))
      else if (tipo === "luna_indice") setLunaEspecs(s => ({ ...s, indice: nombre }))
      else if (tipo === "luna_tratamiento") setLunaEspecs(s => ({ ...s, tratamientos: s.tratamientos.includes(nombre) ? s.tratamientos : [...s.tratamientos, nombre] }))
      else if (tipo === "rx_material") setRx(r => ({ ...r, material: nombre }))
      else if (tipo === "rx_tratamiento") setRx(r => ({ ...r, tratamiento: nombre }))
      else if (tipo === "rx_diseno") setRx(r => ({ ...r, diseno: nombre }))
      setDialogNuevaOpcion(null)
      setNuevaOpcionNombre("")
      toast.success(`"${nombre}" agregado`)
    },
    onError: (e) => toast.error(errMsg(e, "Error al agregar opción")),
  })

  const crearProductoMut = useMutation({
    mutationFn: ({ nombre, tipo }: { nombre: string; tipo: "armazon" | "luna" }) => {
      const catNombre = tipo === "luna" ? "lunas" : "armazones"
      const cat = categorias.find(c => c.nombre.toLowerCase() === catNombre)
      return api.post("/productos", {
        nombre, categoria_id: cat?.id ?? null, precio_costo: 0, precio_venta: 0, stock_actual: 0, stock_minimo: 0, unidad: "unidad",
      }).then(r => ({ producto: r.data as ProductoMin, tipo }))
    },
    onSuccess: ({ producto, tipo }) => {
      qc.invalidateQueries({ queryKey: ["productos-mini"] })
      if (tipo === "armazon") {
        setArmazonProductoId(String(producto.id))
        setForm(f => ({ ...f, armazon_ref: producto.nombre }))
        setPrecioItem("arm", "monto", (producto.precio_venta ?? 0).toFixed(2))
      } else {
        setLunaProductoId(String(producto.id))
        setPrecioItem("lun", "monto", (producto.precio_venta ?? 0).toFixed(2))
      }
      toast.success(`Producto "${producto.nombre}" creado`)
    },
    onError: (e) => toast.error(errMsg(e, "Error al crear producto")),
  })

  const estadoMut = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) =>
      api.patch(`/ordenes/${id}/estado`, null, { params: { estado } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordenes"] }); toast.success("Estado actualizado") },
    onError: () => toast.error("Error al actualizar estado"),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/ordenes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordenes"] }); toast.success("Orden eliminada y stock repuesto") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al eliminar orden"),
  })

  const waApiMut = useMutation({
    mutationFn: (id: number) => api.post(`/ordenes/${id}/whatsapp-lab`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordenes"] }); toast.success("Orden enviada al lab por WhatsApp ✓") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al enviar WhatsApp"),
  })

  // Nombre y teléfono vienen con cada orden desde el backend
  const pacIndex = new Map(ordenes.map(o => [o.paciente_id, o]))
  function pacienteNombre(id: number) {
    return pacIndex.get(id)?.paciente_nombre ?? `Pac. #${id}`
  }

  function pacienteTelefono(id: number) {
    return pacIndex.get(id)?.paciente_telefono ?? null
  }

  function cargarDesdeConsulta(id: string, fuente?: typeof fuenteRx) {
    setConsultaSelId(id)
    const c = consultasDePaciente.find(c => c.id === Number(id))
    if (!c) return
    const src = fuente ?? fuenteRx
    const fmtN = (v: number | null | undefined, decimals = 2) => v != null ? Number(v).toFixed(decimals) : ""
    if (src === "refraccion") {
      setRx(r => ({
        ...r,
        od: { esf: fmtN(c.rx_od_esf), cil: fmtN(c.rx_od_cil), eje: fmtN(c.rx_od_eje, 0), add: fmtN(c.rx_od_add), prisma: "", dnp: "" },
        oi: { esf: fmtN(c.rx_oi_esf), cil: fmtN(c.rx_oi_cil), eje: fmtN(c.rx_oi_eje, 0), add: fmtN(c.rx_oi_add), prisma: "", dnp: "" },
        diagnostico: c.diagnostico ?? r.diagnostico,
      }))
      toast.success("Refracción cargada")
    } else if (src === "lentes") {
      const lc = c.recetas?.find(r => r.tipo === "lente_convencional")
      if (!lc) { toast.warning("Esta consulta no tiene receta de lentes convencionales"); return }
      setRx(r => ({
        ...r,
        od: { esf: fmtN(lc.lc_od_esf), cil: fmtN(lc.lc_od_cil), eje: fmtN(lc.lc_od_eje, 0), add: fmtN(lc.lc_od_add), prisma: "", dnp: fmtN(lc.lc_od_dnp) },
        oi: { esf: fmtN(lc.lc_oi_esf), cil: fmtN(lc.lc_oi_cil), eje: fmtN(lc.lc_oi_eje, 0), add: fmtN(lc.lc_oi_add), prisma: "", dnp: fmtN(lc.lc_oi_dnp) },
        diseno: lc.tipo_lente ?? r.diseno,
        diagnostico: c.diagnostico ?? r.diagnostico,
      }))
      toast.success("Receta de lentes convencionales cargada")
    } else if (src === "contacto") {
      const cl = c.recetas?.find(r => r.tipo === "contactologia")
      if (!cl) { toast.warning("Esta consulta no tiene receta de contactología"); return }
      setRx(r => ({
        ...r,
        od: { esf: fmtN(cl.cl_od_esf), cil: fmtN(cl.cl_od_cil), eje: fmtN(cl.cl_od_eje, 0), add: "", prisma: "", dnp: "" },
        oi: { esf: fmtN(cl.cl_oi_esf), cil: fmtN(cl.cl_oi_cil), eje: fmtN(cl.cl_oi_eje, 0), add: "", prisma: "", dnp: "" },
        diagnostico: c.diagnostico ?? r.diagnostico,
      }))
      toast.success("Receta de contactología cargada")
    }
  }

  useEffect(() => {
    const pre = (location.state as any)?.fromPresupuesto
    if (pre) {
      setEditOrden(null)
      setRx({ ...EMPTY_RX, od: { ...EMPTY_RX_OJO }, oi: { ...EMPTY_RX_OJO } })
      setPartes([newParte()])
      setConsultaSelId("")
      // Precios del presupuesto: la 1.ª línea de armazón y de lunas van a sus filas; el resto como líneas extra
      if (Array.isArray(pre.items) && pre.items.length) {
        const filas: { id: string; descripcion: string; monto: string }[] = []
        let arm = false, lun = false
        pre.items.forEach((it: { descripcion: string; subtotal: number }, i: number) => {
          const d = (it.descripcion ?? "").toLowerCase()
          let id = `pre${i}`
          if (!arm && /armaz|montura/.test(d)) { id = "arm"; arm = true }
          else if (!lun && /luna|lente/.test(d)) { id = "lun"; lun = true }
          filas.push({ id, descripcion: it.descripcion, monto: Number(it.subtotal).toFixed(2) })
        })
        if (!arm) filas.unshift({ id: "arm", descripcion: "Armazón", monto: "" })
        if (!lun) filas.splice(1, 0, { id: "lun", descripcion: "Lunas", monto: "" })
        setPrecioItems(filas)
      }
      setOpenForm(true)
    }
    const ft = (location.state as any)?.fromTurno
    if (ft) {
      setEditOrden(null)
      setForm(f => ({ ...f, paciente_id: ft.paciente_id ? String(ft.paciente_id) : "" }))
      setPartes([newParte()])
      setOpenForm(true)
    }
    const fc = (location.state as any)?.fromConsulta
    if (fc) {
      const fmtN = (v: number | null | undefined, decimals = 2) => v != null ? Number(v).toFixed(decimals) : ""
      setEditOrden(null)
      setForm(f => ({ ...f, paciente_id: fc.paciente_id ? String(fc.paciente_id) : "" }))
      setRx({
        ...EMPTY_RX,
        od: { esf: fmtN(fc.od?.esf), cil: fmtN(fc.od?.cil), eje: fmtN(fc.od?.eje), add: fmtN(fc.od?.add), prisma: "", dnp: "" },
        oi: { esf: fmtN(fc.oi?.esf), cil: fmtN(fc.oi?.cil), eje: fmtN(fc.oi?.eje), add: fmtN(fc.oi?.add), prisma: "", dnp: "" },
        diagnostico: fc.diagnostico || "",
      })
      setConsultaSelId(String(fc.consulta_id))
      setPartes([newParte()])
      setOpenForm(true)
    }
  }, [])

  function openNew() {
    setEditOrden(null)
    setForm({ ...EMPTY_FORM })
    setRx({ ...EMPTY_RX, od: { ...EMPTY_RX_OJO }, oi: { ...EMPTY_RX_OJO } })
    setPartes([newParte()])
    setConsultaSelId("")
    setFuenteRx("refraccion")
    setPrecioItems([
      { id: "arm", descripcion: "Armazón", monto: "" },
      { id: "lun", descripcion: "Lunas", monto: "" },
    ])
    setLunaEspecs({ ...EMPTY_LUNA_ESPECS })
    setArmazonProductoId("")
    setLunaProductoId("")
    setOpenForm(true)
  }

  function openEdit(o: Orden) {
    setEditOrden(o)
    setArmazonProductoId((o as any).armazon_producto_id ? String((o as any).armazon_producto_id) : "")
    setLunaProductoId((o as any).luna_producto_id ? String((o as any).luna_producto_id) : "")
    setRx(descToRx(o.descripcion))
    setForm({
      paciente_id: o.paciente_id.toString(),
      tipo: o.tipo,
      fecha_envio: o.fecha_envio,
      notas: o.notas ?? "",
      referencia: o.referencia ?? "",
      armazon_ref: (o as any).armazon_ref ?? "",
      armazon_color: (o as any).armazon_color ?? "",
      armazon_talla: (o as any).armazon_talla ?? "",
      precio_armazon: (o as any).precio_armazon?.toString() ?? "",
      precio_lunas: (o as any).precio_lunas?.toString() ?? "",
      precio_venta: (o as any).precio_venta?.toString() ?? "",
    })
    const pArm = Number((o as any).precio_armazon ?? 0)
    const pLun = Number((o as any).precio_lunas ?? 0)
    const pVen = Number((o as any).precio_venta ?? 0)
    const extras = pVen - pArm - pLun
    const editItems: { id: string; descripcion: string; monto: string }[] = [
      { id: "arm", descripcion: "Armazón", monto: pArm > 0 ? pArm.toFixed(2) : "" },
      { id: "lun", descripcion: "Lunas", monto: pLun > 0 ? pLun.toFixed(2) : "" },
    ]
    if (extras > 0.01) editItems.push({ id: "ext", descripcion: "Otros", monto: extras.toFixed(2) })
    setPrecioItems(editItems)
    setLunaEspecs({
      material: (o as any).luna_material ?? "",
      indice: (o as any).luna_indice ?? "",
      tratamientos: (o as any).luna_tratamientos ? ((o as any).luna_tratamientos as string).split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      color: (o as any).luna_color ?? "",
      diametro: (o as any).luna_diametro ?? "",
    })
    const ojosGuardado = /Ojo:\s*(od|oi|ao)/i.exec(o.notas ?? "")?.[1] as "od" | "oi" | "ao" | undefined
    setPartes([{
      _id: "edit",
      nombre: "Completo",
      ojos: ojosGuardado ?? "ao",
      fuente: o.lab_proveedor === "Stock propio" ? "stock" : "lab",
      proveedor_id: o.proveedor_id?.toString() ?? "",
      lab_proveedor: o.lab_proveedor,
      lab_telefono: o.lab_telefono ?? "",
      fecha_entrega_est: o.fecha_entrega_est ?? "",
      precio_lab: o.precio_lab?.toString() ?? "",
      producto_id: "",
    }])
    setOpenForm(true)
  }

  function setParteField(id: string, field: keyof OrdenParte, value: string) {
    setPartes(ps => ps.map(p => p._id === id ? { ...p, [field]: value } : p))
  }

  function handleParteProveedorChange(pid: string, parteId: string) {
    const prov = proveedores.find(p => p.id === Number(pid))
    setPartes(ps => ps.map(p => p._id === parteId ? {
      ...p,
      proveedor_id: pid,
      lab_proveedor: prov ? prov.nombre : p.lab_proveedor,
      lab_telefono: prov?.telefono ?? p.lab_telefono,
    } : p))
  }

  function handleParteProductoChange(productoId: string, parteId: string) {
    const prod = productosMini.find(p => p.id === Number(productoId))
    setPartes(ps => ps.map(p => p._id === parteId ? {
      ...p,
      producto_id: productoId,
      precio_lab: prod?.precio_costo != null ? String(prod.precio_costo) : p.precio_lab,
    } : p))
    // Auto-fill precio_venta from product if not already set
    if (prod?.precio_venta != null && Number(prod.precio_venta) > 0 && !form.precio_venta) {
      setForm(f => ({ ...f, precio_venta: String(prod.precio_venta) }))
    }
  }

  function handleParteFuente(fuente: "lab" | "stock", parteId: string) {
    setPartes(ps => ps.map(p => p._id === parteId ? {
      ...p,
      fuente,
      lab_proveedor: fuente === "stock" ? "Stock propio" : (p.lab_proveedor === "Stock propio" ? "" : p.lab_proveedor),
      lab_telefono: fuente === "stock" ? "" : p.lab_telefono,
    } : p))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.paciente_id) { toast.error("Selecciona el paciente"); return }

    const descripcion = rxToDesc(rx) || "—"
    setSaving(true)
    try {
      // Se identifica cada fila por su id fijo ("arm"/"lun"), no por el texto:
      // si el usuario renombra "Armazón" a "Montura" el precio no se pierde.
      const montoDe = (id: string) => parseFloat(precioItems.find(i => i.id === id)?.monto ?? "") || 0
      const pArmazon = montoDe("arm") || null
      const pLunas = montoDe("lun") || null
      const pVentaCalc = precioTotal > 0 ? precioTotal : (form.precio_venta ? Number(form.precio_venta) : null)
      const extraFields = {
        armazon_ref: form.armazon_ref || null,
        armazon_color: form.armazon_color || null,
        armazon_talla: form.armazon_talla || null,
        armazon_producto_id: armazonProductoId ? Number(armazonProductoId) : null,
        precio_armazon: pArmazon,
        precio_lunas: pLunas,
        precio_venta: pVentaCalc,
        luna_material: lunaEspecs.material || null,
        luna_indice: lunaEspecs.indice || null,
        luna_tratamientos: lunaEspecs.tratamientos.length ? lunaEspecs.tratamientos.join(", ") : null,
        luna_color: lunaEspecs.color || null,
        luna_diametro: lunaEspecs.diametro || null,
        luna_producto_id: lunaProductoId ? Number(lunaProductoId) : null,
      }
      if (editOrden) {
        const parte = partes[0]
        const labProv = parte.fuente === "stock" ? "Stock propio" : (parte.lab_proveedor || "Pendiente")
        await api.put(`/ordenes/${editOrden.id}`, {
          paciente_id: Number(form.paciente_id),
          consulta_id: consultaSelId ? Number(consultaSelId) : editOrden.consulta_id ?? null,
          tipo: form.tipo,
          descripcion,
          fecha_envio: form.fecha_envio,
          notas: form.notas || null,
          referencia: form.referencia || null,
          proveedor_id: parte.proveedor_id ? Number(parte.proveedor_id) : null,
          lab_proveedor: labProv,
          lab_telefono: parte.fuente === "stock" ? null : (parte.lab_telefono || null),
          fecha_entrega_est: parte.fecha_entrega_est || null,
          precio_lab: parte.precio_lab ? Number(parte.precio_lab) : null,
          ...extraFields,
        })
        toast.success("Orden actualizada")
      } else {
        for (const [idx, parte] of partes.entries()) {
          const labProv = parte.fuente === "stock" ? "Stock propio" : (parte.lab_proveedor || "Pendiente")
          const prodNombre = parte.producto_id ? productosMini.find(p => p.id === Number(parte.producto_id))?.nombre : null
          await api.post("/ordenes", {
            paciente_id: Number(form.paciente_id),
            consulta_id: consultaSelId ? Number(consultaSelId) : null,
            tipo: form.tipo,
            descripcion,
            fecha_envio: form.fecha_envio,
            notas: [form.notas, `Ojo: ${parte.ojos}`, parte.fuente === "stock" ? "Fuente: Stock propio" : null, prodNombre ? `Producto: ${prodNombre}` : null].filter(Boolean).join(" | ") || null,
            referencia: form.referencia || null,
            proveedor_id: parte.proveedor_id ? Number(parte.proveedor_id) : null,
            lab_proveedor: labProv,
            lab_telefono: parte.fuente === "stock" ? null : (parte.lab_telefono || null),
            fecha_entrega_est: parte.fecha_entrega_est || null,
            precio_lab: parte.precio_lab ? Number(parte.precio_lab) : null,
            producto_id: parte.fuente === "stock" && parte.producto_id ? Number(parte.producto_id) : null,
            presupuesto_id: idx === 0 && presupuestoOrigen ? presupuestoOrigen.id : null,
            ...extraFields,
          })
        }
        toast.success(partes.length > 1 ? `${partes.length} órdenes creadas` : "Orden creada")
        if (presupuestoOrigen) {
          toast.info(`Presupuesto ${presupuestoOrigen.numero} marcado como convertido`)
          setPresupuestoOrigen(null)
          qc.invalidateQueries({ queryKey: ["presupuestos"] })
        }
      }
      qc.invalidateQueries({ queryKey: ["ordenes"] })
      setOpenForm(false)
    } catch (e) {
      toast.error(errMsg(e, "Error al guardar"))
    } finally {
      setSaving(false)
    }
  }

  const ordenesFiltradas = ordenes.filter(o =>
    !filtroPaciente || pacienteNombre(o.paciente_id).toLowerCase().includes(filtroPaciente.toLowerCase())
  )

  return {
    location,
    navigate,
    filtroEstado,
    setFiltroEstado,
    filtroPaciente,
    setFiltroPaciente,
    mesOffset,
    setMesOffset,
    filtroDesde,
    setFiltroDesde,
    filtroHasta,
    setFiltroHasta,
    irAMes,
    verTodoMes,
    vistaKanban,
    setVistaKanban,
    page,
    setPage,
    PER_PAGE,
    setPER_PAGE,
    openForm,
    setOpenForm,
    editOrden,
    setEditOrden,
    form,
    setForm,
    rolUsuario,
    presupuestoOrigen,
    setPresupuestoOrigen,
    rx,
    setRx,
    partes,
    setPartes,
    precioItems,
    setPrecioItems,
    precioTotal,
    setPrecioItem,
    addPrecioItem,
    removePrecioItem,
    EMPTY_LUNA_ESPECS,
    lunaEspecs,
    setLunaEspecs,
    armazonProductoId,
    setArmazonProductoId,
    lunaProductoId,
    setLunaProductoId,
    saving,
    setSaving,
    estadoDropdown,
    setEstadoDropdown,
    estadoAnchorRef,
    consultaSelId,
    setConsultaSelId,
    fuenteRx,
    setFuenteRx,
    qc,
    brandLogo,
    config,
    waCloudEnabled,
    ordenes,
    isLoading,
    proveedores,
    consultasDePaciente,
    productosMini,
    categorias,
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
    estadoMut,
    deleteMut,
    waApiMut,
    pacIndex,
    pacienteNombre,
    pacienteTelefono,
    cargarDesdeConsulta,
    openNew,
    openEdit,
    setParteField,
    handleParteProveedorChange,
    handleParteProductoChange,
    handleParteFuente,
    handleSubmit,
    ordenesFiltradas,
  }
}

export type OrdenesCtx = ReturnType<typeof useOrdenes>
