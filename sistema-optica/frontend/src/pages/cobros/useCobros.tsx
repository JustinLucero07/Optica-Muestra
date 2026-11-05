// Estado, consultas y acciones de la pantalla Cobros y egresos.
// La pantalla (Cobros.tsx) y sus ventanas (CobrosDialogos.tsx) comparten este mismo estado.
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, type UseFormRegisterReturn } from "react-hook-form"
import { toast } from "sonner"
import { type LucideIcon, TrendingUp, TrendingDown, Wallet, AlertCircle, AlertTriangle } from "lucide-react"
import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { cuentasParaMetodo, cuentaPorDefecto, METODOS_PAGO, metodoLabel } from "@/lib/metodosCuenta"
import { useAuthStore } from "@/store/auth"
import { fmtMoney as fmt, hoyISO, rangoMes } from "@/lib/format"
import { Tab, Cuenta, Cobro, Egreso, CxP, CxPItem, ProductoMin, VentaPendiente, CobroForm, EgresoForm, CxPForm, PagoForm, TransferenciaForm, NuevaCuentaForm, Transferencia } from "@/pages/cobros/tipos"

export function useCobros() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get("tab") as Tab) ?? "cobros"
  const setTab = (t: Tab) => setSearchParams({ tab: t }, { replace: true })

  const [mesOffset, setMesOffset] = useState(0)
  const [desde, setDesde] = useState(() => rangoMes(0).desde)
  const [hasta, setHasta] = useState(() => rangoMes(0).hasta)
  function irAMes(offset: number) {
    const r = rangoMes(offset)
    setMesOffset(offset)
    setDesde(r.desde)
    setHasta(r.hasta)
    setPageCobros(1)
    setPageEgresos(1)
  }
  function verTodo() {
    setMesOffset(NaN)
    setDesde("")
    setHasta("")
    setPageCobros(1)
    setPageEgresos(1)
  }
  const nombreMes = (offset: number) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + offset)
    return d.toLocaleDateString("es-EC", { month: "long", year: "numeric" })
  }
  const [busqConcepto, setBusqConcepto] = useState("")
  const [pageCobros, setPageCobros] = useState(1)
  const [pageEgresos, setPageEgresos] = useState(1)
  const [pageCxP, setPageCxP] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [dialogCobro, setDialogCobro] = useState(false)
  const [dialogEgreso, setDialogEgreso] = useState(false)
  const [dialogCxP, setDialogCxP] = useState(false)
  const [pagandoCxP, setPagandoCxP] = useState<CxP | null>(null)
  const [expandedCxP, setExpandedCxP] = useState<number | null>(null)
  const [dialogNuevoProd, setDialogNuevoProd] = useState<CxPItem | null>(null)
  const [nuevoProdNombre, setNuevoProdNombre] = useState("")
  const [nuevoProdCodigo, setNuevoProdCodigo] = useState("")
  const [nuevoProdPrecioCosto, setNuevoProdPrecioCosto] = useState("")
  const [nuevoProdPrecioVenta, setNuevoProdPrecioVenta] = useState("")
  const [dialogTransferencia, setDialogTransferencia] = useState(false)
  const [dialogNuevaCuenta, setDialogNuevaCuenta] = useState(false)
  const [editandoCuenta, setEditandoCuenta] = useState<Cuenta | null>(null)

  // venta selection state for cobro dialog
  const [ventaSel, setVentaSel] = useState<VentaPendiente | null>(null)
  const [busqVenta, setBusqVenta] = useState("")
  const [showVentaList, setShowVentaList] = useState(false)

  const qc = useQueryClient()
  const rol = useAuthStore((s) => s.user?.role)
  const veTesoreria = rol === "admin" || rol === "cajero"

  const { data: cuentas = [] } = useQuery<Cuenta[]>({
    queryKey: ["cuentas-bancarias"],
    queryFn: () => api.get("/cuentas-bancarias").then(r => r.data),
  })

  const { data: cobros = [], isLoading: cargCobros } = useQuery<Cobro[]>({
    queryKey: ["cobros", desde, hasta],
    queryFn: () => api.get("/cobros", { params: { desde: desde || undefined, hasta: hasta || undefined, limit: 5000 } }).then(r => r.data),
  })

  const { data: egresos = [], isLoading: cargEgr } = useQuery<Egreso[]>({
    queryKey: ["egresos", desde, hasta],
    queryFn: () => api.get("/egresos", { params: { desde: desde || undefined, hasta: hasta || undefined, limit: 5000 } }).then(r => r.data),
    enabled: veTesoreria,
  })

  const { data: cxps = [], isLoading: cargCxP } = useQuery<CxP[]>({
    queryKey: ["cxp"],
    queryFn: () => api.get("/cxp", { params: { limit: 5000 } }).then(r => r.data),
    enabled: tab === "cxp" && veTesoreria,
  })

  const { data: cxpItems = [] } = useQuery<CxPItem[]>({
    queryKey: ["cxp-items", expandedCxP],
    queryFn: () => api.get(`/cxp/${expandedCxP}/items`).then(r => r.data),
    enabled: !!expandedCxP,
  })

  const { data: productosMin = [] } = useQuery<ProductoMin[]>({
    queryKey: ["productos-mini"],
    queryFn: () => api.get("/productos", { params: { limit: 500 } }).then(r => r.data),
    enabled: tab === "cxp",
  })

  // ventas pendientes para el selector de cobro
  const { data: ventasPendientes = [] } = useQuery<VentaPendiente[]>({
    queryKey: ["ventas-pendientes"],
    queryFn: () => api.get("/ventas", { params: { estado: "pendiente", limit: 200 } }).then(r => r.data),
    enabled: dialogCobro,
  })

  // cobros ya registrados de la venta seleccionada
  const { data: cobrosVenta = [] } = useQuery<Cobro[]>({
    queryKey: ["cobros-venta", ventaSel?.id],
    queryFn: () => api.get("/cobros", { params: { venta_id: ventaSel!.id } }).then(r => r.data),
    enabled: !!ventaSel,
  })

  const abonadoVenta = cobrosVenta.reduce((s, c) => s + c.monto, 0)
  const saldoVenta = ventaSel ? Math.max(0, ventaSel.total - abonadoVenta) : 0

  const { data: transferencias = [] } = useQuery<Transferencia[]>({
    queryKey: ["transferencias"],
    queryFn: () => api.get("/transferencias").then(r => r.data),
    enabled: tab === "cuentas" && veTesoreria,
  })

  const { register: rC, handleSubmit: hsC, reset: resetC, setValue: svC, watch: watchC } = useForm<CobroForm>()
  const { register: rE, handleSubmit: hsE, reset: resetE, watch: watchE } = useForm<EgresoForm>()
  const { register: rCxP, handleSubmit: hsCxP, reset: resetCxP } = useForm<CxPForm>()
  const { register: rPago, handleSubmit: hsPago, reset: resetPago, watch: watchPago } = useForm<PagoForm>()
  const { register: rTrf, handleSubmit: hsTrf, reset: resetTrf, watch: watchTrf } = useForm<TransferenciaForm>()
  const { register: rNC, handleSubmit: hsNC, reset: resetNC } = useForm<NuevaCuentaForm>()

  // auto-fill monto when venta selection + cobros load
  useEffect(() => {
    if (ventaSel) {
      svC("concepto", `Cobro venta ${ventaSel.numero}`)
      svC("monto", saldoVenta.toFixed(2))
    }
  }, [ventaSel, abonadoVenta])

  const cobroMut = useMutation({
    mutationFn: (d: CobroForm) => api.post("/cobros", {
      venta_id: ventaSel?.id ?? null,
      cuenta_bancaria_id: Number(d.cuenta_bancaria_id),
      fecha: d.fecha, concepto: d.concepto, monto: Number(d.monto),
      metodo_pago: d.metodo_pago, referencia: d.referencia || null, notas: d.notas || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cobros"] })
      qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] })
      qc.invalidateQueries({ queryKey: ["ventas-pendientes"] })
      qc.invalidateQueries({ queryKey: ["cobros-venta"] })
      setDialogCobro(false)
      toast.success("Cobro registrado")
    },
    onError: (e) => toast.error(errMsg(e, "Error")),
  })

  const egresoMut = useMutation({
    mutationFn: (d: EgresoForm) => api.post("/egresos", {
      cuenta_bancaria_id: Number(d.cuenta_bancaria_id),
      fecha: d.fecha, categoria: d.categoria, concepto: d.concepto, monto: Number(d.monto),
      metodo_pago: d.metodo_pago, referencia: d.referencia || null, notas: d.notas || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["egresos"] }); qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] }); setDialogEgreso(false); toast.success("Egreso registrado") },
    onError: (e) => toast.error(errMsg(e, "Error")),
  })

  const cxpMut = useMutation({
    mutationFn: (d: CxPForm) => api.post("/cxp", {
      proveedor: d.proveedor, concepto: d.concepto, monto_total: Number(d.monto_total),
      fecha_emision: d.fecha_emision, fecha_vencimiento: d.fecha_vencimiento || null,
      referencia: d.referencia || null, notas: d.notas || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cxp"] }); setDialogCxP(false); toast.success("CxP creada") },
    onError: (e) => toast.error(errMsg(e, "Error")),
  })

  const pagoMut = useMutation({
    mutationFn: (d: PagoForm) => api.post(`/cxp/${pagandoCxP!.id}/pago`, {
      monto: Number(d.monto), cuenta_bancaria_id: Number(d.cuenta_bancaria_id),
      fecha: d.fecha, metodo_pago: d.metodo_pago, referencia: d.referencia || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cxp"] }); qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] }); setPagandoCxP(null); toast.success("Pago registrado") },
    onError: (e) => toast.error(errMsg(e, "Error")),
  })

  const eliminarCxPMut = useMutation({
    mutationFn: (id: number) => api.delete(`/cxp/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cxp"] }); toast.success("CxP eliminada") },
    onError: (e) => toast.error(errMsg(e, "No se puede eliminar")),
  })

  const eliminarCxPItemMut = useMutation({
    mutationFn: (itemId: number) => api.delete(`/sri/items/${itemId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cxp-items", expandedCxP] }); toast.success("Ítem eliminado") },
    onError: (e) => toast.error(errMsg(e, "Error al eliminar ítem")),
  })

  const [dialogNuevoItem, setDialogNuevoItem] = useState<number | null>(null)
  const [nuevoItemCodigo, setNuevoItemCodigo] = useState("")
  const [nuevoItemDescripcion, setNuevoItemDescripcion] = useState("")
  const [nuevoItemCantidad, setNuevoItemCantidad] = useState("1")
  const [nuevoItemPrecio, setNuevoItemPrecio] = useState("")

  const crearCxPItemMut = useMutation({
    mutationFn: () => api.post("/sri/items", {
      cxp_id: dialogNuevoItem,
      codigo_proveedor: nuevoItemCodigo.trim() || null,
      descripcion: nuevoItemDescripcion.trim(),
      cantidad: Number(nuevoItemCantidad),
      precio_unitario: Number(nuevoItemPrecio),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cxp-items", expandedCxP] })
      setDialogNuevoItem(null)
      toast.success("Ítem agregado")
    },
    onError: (e) => toast.error(errMsg(e, "Error al agregar ítem")),
  })

  function abrirNuevoItem(cxpId: number) {
    setNuevoItemCodigo("")
    setNuevoItemDescripcion("")
    setNuevoItemCantidad("1")
    setNuevoItemPrecio("")
    setDialogNuevoItem(cxpId)
  }

  const [pagandoProveedor, setPagandoProveedor] = useState<string | null>(null)
  const [pagoTodoMonto, setPagoTodoMonto] = useState("")
  const [pagoTodoCuentaId, setPagoTodoCuentaId] = useState("")
  const [pagoTodoMetodo, setPagoTodoMetodo] = useState("efectivo")
  const [pagoTodoFecha, setPagoTodoFecha] = useState(hoyISO())

  const pagarTodoMut = useMutation({
    mutationFn: async () => {
      const facturas = cxps
        .filter(c => c.proveedor === pagandoProveedor && c.estado !== "pagado")
        .sort((a, b) => a.fecha_emision.localeCompare(b.fecha_emision))
      let restante = Number(pagoTodoMonto)
      let pagadas = 0
      for (const f of facturas) {
        if (restante <= 0.009) break
        const pendiente = f.monto_total - f.monto_pagado
        const monto = Math.min(restante, pendiente)
        if (monto <= 0.009) continue
        await api.post(`/cxp/${f.id}/pago`, {
          monto, cuenta_bancaria_id: Number(pagoTodoCuentaId),
          fecha: pagoTodoFecha, metodo_pago: pagoTodoMetodo, referencia: null,
        })
        restante -= monto
        pagadas++
      }
      return pagadas
    },
    onSuccess: (pagadas) => {
      qc.invalidateQueries({ queryKey: ["cxp"] })
      qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] })
      setPagandoProveedor(null)
      toast.success(`${pagadas} factura(s) pagada(s)`)
    },
    onError: (e) => toast.error(errMsg(e, "Error al pagar")),
  })

  function abrirPagoTodo(proveedor: string, totalPendiente: number) {
    setPagoTodoMonto(totalPendiente.toFixed(2))
    setPagoTodoCuentaId(cuentaPorDefecto(cuentas, "efectivo", false)?.id.toString() ?? "")
    setPagoTodoMetodo("efectivo")
    setPagoTodoFecha(hoy)
    setPagandoProveedor(proveedor)
  }

  const eliminarCobroMut = useMutation({
    mutationFn: (id: number) => api.delete(`/cobros/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cobros"] }); qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] }); toast.success("Cobro eliminado") },
    onError: (e) => toast.error(errMsg(e, "Error al eliminar")),
  })

  const eliminarEgresoMut = useMutation({
    mutationFn: (id: number) => api.delete(`/egresos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["egresos"] }); qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] }); toast.success("Egreso eliminado") },
    onError: (e) => toast.error(errMsg(e, "Error al eliminar")),
  })

  const transferenciaMut = useMutation({
    mutationFn: (d: TransferenciaForm) => api.post("/transferencias", {
      fecha: d.fecha, cuenta_origen_id: Number(d.cuenta_origen_id),
      cuenta_destino_id: Number(d.cuenta_destino_id), monto: Number(d.monto),
      comision: d.comision ? Number(d.comision) : 0,
      concepto: d.concepto || null, notas: d.notas || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] })
      qc.invalidateQueries({ queryKey: ["transferencias"] })
      setDialogTransferencia(false)
      toast.success("Transferencia registrada")
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const nuevaCuentaMut = useMutation({
    mutationFn: (d: NuevaCuentaForm) => {
      const payload = { nombre: d.nombre, tipo: d.tipo, saldo_inicial: Number(d.saldo_inicial) || 0 }
      return editandoCuenta
        ? api.put(`/cuentas-bancarias/${editandoCuenta.id}`, payload)
        : api.post("/cuentas-bancarias", payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] })
      setDialogNuevaCuenta(false)
      setEditandoCuenta(null)
      toast.success(editandoCuenta ? "Cuenta actualizada" : "Cuenta creada")
    },
    onError: (e) => toast.error(errMsg(e, "Error al guardar cuenta")),
  })

  const eliminarCuentaMut = useMutation({
    mutationFn: (id: number) => api.delete(`/cuentas-bancarias/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] })
      toast.success("Cuenta eliminada")
    },
    onError: (e) => toast.error(errMsg(e, "Error al eliminar cuenta")),
  })

  function abrirNuevaCuenta() {
    setEditandoCuenta(null)
    resetNC({ nombre: "", tipo: "banco", saldo_inicial: "0" })
    setDialogNuevaCuenta(true)
  }

  function abrirEditarCuenta(c: Cuenta) {
    setEditandoCuenta(c)
    resetNC({ nombre: c.nombre, tipo: c.tipo, saldo_inicial: "" })
    setDialogNuevaCuenta(true)
  }

  const hoy = hoyISO()
  const totalCobros = cobros.reduce((s, c) => s + c.monto, 0)
  const totalEgresos = egresos.reduce((s, e) => s + e.monto, 0)
  const totalActivos = cuentas.filter(c => c.activa).reduce((s, c) => s + c.saldo_actual, 0)
  const cxpPendiente = cxps.filter(c => c.estado !== "pagado").reduce((s, c) => s + (c.monto_total - c.monto_pagado), 0)

  const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "cobros", label: "Cobros", icon: TrendingUp },
    // Egresos y deudas con proveedores: solo admin y cajero (el backend también lo restringe)
    ...(veTesoreria ? [
      { id: "egresos" as Tab, label: "Egresos", icon: TrendingDown },
      { id: "cxp" as Tab, label: "Por pagar a proveedores", icon: AlertCircle },
    ] : []),
    ...(veTesoreria ? [{ id: "cuentas" as Tab, label: "Saldos de cuentas", icon: Wallet }] : []),
  ]

  // Botón "+" flotante → /cobros?nuevo=1 abre el formulario (cuando ya cargaron las cuentas)
  useEffect(() => {
    if (searchParams.get("nuevo") && cuentas.length) {
      abrirCobro()
      setSearchParams({ tab: "cobros" }, { replace: true })
    }
  }, [searchParams, cuentas.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirCobro() {
    resetC({ fecha: hoy, metodo_pago: "efectivo", cuenta_bancaria_id: cuentaPorDefecto(cuentas, "efectivo", true)?.id.toString() ?? "" })
    setVentaSel(null)
    setBusqVenta("")
    setDialogCobro(true)
  }
  function cerrarCobro() { setDialogCobro(false); setVentaSel(null); setBusqVenta("") }
  function abrirEgreso() { resetE({ fecha: hoy, metodo_pago: "efectivo", cuenta_bancaria_id: cuentaPorDefecto(cuentas, "efectivo", false)?.id.toString() ?? "" }); setDialogEgreso(true) }
  function abrirCxP() { resetCxP({ fecha_emision: hoy }); setDialogCxP(true) }
  function abrirPago(c: CxP) { resetPago({ fecha: hoy, metodo_pago: "efectivo", monto: String(c.monto_total - c.monto_pagado), cuenta_bancaria_id: cuentaPorDefecto(cuentas, "efectivo", false)?.id.toString() ?? "" }); setPagandoCxP(c) }

  function seleccionarVenta(v: VentaPendiente) {
    setVentaSel(v)
    setBusqVenta("")
    setShowVentaList(false)
  }

  // Auto-seleccionar cuenta según método de pago del cobro
  const metodoC = watchC("metodo_pago")
  useEffect(() => {
    if (!cuentas.length) return
    if (!cuentasParaMetodo(cuentas, metodoC, true).some(c => c.id === Number(watchC("cuenta_bancaria_id")))) {
      svC("cuenta_bancaria_id", String(cuentaPorDefecto(cuentas, metodoC, true)?.id ?? ""))
    }
  }, [metodoC, cuentas.length])

  function limpiarVenta() {
    setVentaSel(null)
    setBusqVenta("")
    svC("concepto", "")
    svC("monto", "")
  }

  const ventasFiltradas = ventasPendientes.filter(v => {
    const q = busqVenta.toLowerCase()
    return !q || v.numero.toLowerCase().includes(q) || (v.paciente_nombre ?? "").toLowerCase().includes(q)
  })

  const SelectCuenta = ({ reg, metodo, esIngreso = true }: { reg: UseFormRegisterReturn; metodo: string; esIngreso?: boolean }) => (
    <select {...reg} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {cuentasParaMetodo(cuentas, metodo ?? "efectivo", esIngreso).map(c => <option key={c.id} value={c.id}>{c.nombre} ({fmt(c.saldo_actual)})</option>)}
    </select>
  )

  function SaldoAviso({ cuentaId, monto }: { cuentaId: string; monto: string }) {
    const cuenta = cuentas.find(c => c.id === Number(cuentaId))
    const m = parseFloat(monto || "0")
    if (!cuenta || !m || m <= 0 || cuenta.saldo_actual >= m) return null
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Saldo insuficiente — <strong>{cuenta.nombre}</strong> tiene <strong>{fmt(cuenta.saldo_actual)}</strong> disponible</span>
      </div>
    )
  }

  const SelectMetodo = ({ reg }: { reg: UseFormRegisterReturn }) => (
    <select {...reg} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {METODOS_PAGO.map(m => <option key={m} value={m}>{metodoLabel(m)}</option>)}
    </select>
  )

  return {
    searchParams,
    setSearchParams,
    tab,
    setTab,
    mesOffset,
    setMesOffset,
    desde,
    setDesde,
    hasta,
    setHasta,
    irAMes,
    verTodo,
    nombreMes,
    busqConcepto,
    setBusqConcepto,
    pageCobros,
    setPageCobros,
    pageEgresos,
    setPageEgresos,
    pageCxP,
    setPageCxP,
    perPage,
    setPerPage,
    dialogCobro,
    setDialogCobro,
    dialogEgreso,
    setDialogEgreso,
    dialogCxP,
    setDialogCxP,
    pagandoCxP,
    setPagandoCxP,
    expandedCxP,
    setExpandedCxP,
    dialogNuevoProd,
    setDialogNuevoProd,
    nuevoProdNombre,
    setNuevoProdNombre,
    nuevoProdCodigo,
    setNuevoProdCodigo,
    nuevoProdPrecioCosto,
    setNuevoProdPrecioCosto,
    nuevoProdPrecioVenta,
    setNuevoProdPrecioVenta,
    dialogTransferencia,
    setDialogTransferencia,
    dialogNuevaCuenta,
    setDialogNuevaCuenta,
    editandoCuenta,
    setEditandoCuenta,
    ventaSel,
    setVentaSel,
    busqVenta,
    setBusqVenta,
    showVentaList,
    setShowVentaList,
    qc,
    rol,
    veTesoreria,
    cuentas,
    cobros,
    cargCobros,
    egresos,
    cargEgr,
    cxps,
    cargCxP,
    cxpItems,
    productosMin,
    ventasPendientes,
    cobrosVenta,
    abonadoVenta,
    saldoVenta,
    transferencias,
    rC,
    hsC,
    resetC,
    svC,
    watchC,
    rE,
    hsE,
    resetE,
    watchE,
    rCxP,
    hsCxP,
    resetCxP,
    rPago,
    hsPago,
    resetPago,
    watchPago,
    rTrf,
    hsTrf,
    resetTrf,
    watchTrf,
    rNC,
    hsNC,
    resetNC,
    cobroMut,
    egresoMut,
    cxpMut,
    pagoMut,
    eliminarCxPMut,
    eliminarCxPItemMut,
    dialogNuevoItem,
    setDialogNuevoItem,
    nuevoItemCodigo,
    setNuevoItemCodigo,
    nuevoItemDescripcion,
    setNuevoItemDescripcion,
    nuevoItemCantidad,
    setNuevoItemCantidad,
    nuevoItemPrecio,
    setNuevoItemPrecio,
    crearCxPItemMut,
    abrirNuevoItem,
    pagandoProveedor,
    setPagandoProveedor,
    pagoTodoMonto,
    setPagoTodoMonto,
    pagoTodoCuentaId,
    setPagoTodoCuentaId,
    pagoTodoMetodo,
    setPagoTodoMetodo,
    pagoTodoFecha,
    setPagoTodoFecha,
    pagarTodoMut,
    abrirPagoTodo,
    eliminarCobroMut,
    eliminarEgresoMut,
    transferenciaMut,
    nuevaCuentaMut,
    eliminarCuentaMut,
    abrirNuevaCuenta,
    abrirEditarCuenta,
    hoy,
    totalCobros,
    totalEgresos,
    totalActivos,
    cxpPendiente,
    TABS,
    abrirCobro,
    cerrarCobro,
    abrirEgreso,
    abrirCxP,
    abrirPago,
    seleccionarVenta,
    metodoC,
    limpiarVenta,
    ventasFiltradas,
    SelectCuenta,
    SaldoAviso,
    SelectMetodo,
  }
}

export type CobrosCtx = ReturnType<typeof useCobros>
